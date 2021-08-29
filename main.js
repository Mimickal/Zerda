/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const fs = require('fs');
const Discord = require('discord.js');

const logger = require('./logger.js');

// TODO temporary easy stuff for testing.
const TOKEN = fs.readFileSync(process.argv[2]).toString().trim();
const CONFIG = require('./config.json');
const PACKAGE = require('./package.json');
const ROLE_NAME = 'Currently Playing';

// TODO this is getting big like the logger. Maybe pull this out to its own file
// TODO handle sharding if we want this in multiple servers
// Set up the Discord client
const Intents = Discord.Intents.FLAGS;
const client = new Discord.Client({
	presence: {
		activity: {
			// I don't like hard-coding this, but Discord.js does not give a
			// nice value in Constants like it does for Events :(
			type: 'PLAYING',
			name: `Version ${PACKAGE.version}`,
		},
	},
	ws: {
		intents: [
			Intents.GUILDS,
			Intents.GUILD_MEMBERS,
			Intents.GUILD_PRESENCES,
		],
	},
});

const Events = Discord.Constants.Events;
client.on(Events.CLIENT_READY, onReady);
client.on(Events.PRESENCE_UPDATE, onPresenceUpdate);
client.on(Events.GUILD_CREATE, onGuildJoin);
client.on(Events.GUILD_DELETE, onGuildLeave);


// TODO Log if we ever message someone.
// TODO check fo API failures (like we can't contact Discord)

logger.info('Logging in...');
client.login(TOKEN).catch(err => {
	logger.error(err.stack);
	process.exit(1);
});


/// Events.CLIENT_READY event handler
async function onReady() {
	logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);

	// TODO catch error if we don't have permissions
	await createRoleAll();
	await assignRolesAll();
}

/// Events.PRESENCE_UPDATE event handler
function onPresenceUpdate(old_presence, new_presence) {
	assignRolesFromPresence(new_presence);
}

/// Events.GUILD_CREATE event handler
async function onGuildJoin(guild) {
	logger.info(`Joined guild "${guild.name}" (${guild.id}) with permissions ${
		guild.member(client.user.id).permissions.bitfield
	}`);

	await createPlayingRole(guild);
	await assignRolesInGuild(guild);
}

/// Events.GUILD_DELETE event handler
function onGuildLeave(guild) {
	logger.info(`Left guild "${guild.name}" (${guild.id})`);
}

/**
 * Applies createPlayingRole to every Guild this bot can see.
 */
async function createRoleAll() {
	logger.info(`Checking all guilds for "${ROLE_NAME}" role...`);
	// TODO do we need to await this? We can probably do all of these at once.
	for await (const guild of client.guilds.cache.values()) {
		await createPlayingRole(guild);
	}
}

/**
 * Creates the "Now Playing" role in the given Guild, if it doesn't already
 * exist.
 *
 * @param guild  A Discord.js Guild object.
 */
async function createPlayingRole(guild) {
	let role = await getPlayingRoleForGuild(guild);
	if (role) {
		logger.debug(
			`Guild ${guild.name} (${guild.id}) already has role ${role.id}`
		);
		return;
	}

	try {
		role = await guild.roles.create({
			data: {
				hoist: true, // VERY IMPORTANT! This bot doesn't work without this!
				mentionable: true,
				name: ROLE_NAME,
				permissions: 0,
				position: 0,
			},
			reason: 'Role for people currently playing',
		});

		logger.info(
			`Created role ${role.id} in guild "${guild.name}" (${guild.id})`
		);
	}
	catch (err) {
		logger.warn(
			`Error creating "${ROLE_NAME}" role in guild "${guild.name}" (${guild.id})`
			+ err.stack
		);

		// TODO probably message guild owner
	}
}

/**
 * Applies assignRolesFromPresence to every GuildMember this bot can see,
 * across all Guilds. We do one Guild at a time, which combined with Discord's
 * rate limit can make this operation take some time to complete.
 */
async function assignRolesAll() {
	logger.info("Beginning initial member check...");
	let guildCount = 0;
	let memberCount = 0;

	for await (const guild of client.guilds.cache.values()) {
		const count = await assignRolesInGuild(guild);
		guildCount++;
		memberCount += count;
	}

	logger.info("Finished initial member check. " +
		`Checked ${memberCount} members across ${guildCount} guilds`);
}

/**
 * Applies assignRolesFromPresence to every GuildMember in the given Guild.
 * We are limited by Discord's API rate limit, so this can take some time to
 * complete.
 *
 * @param guild  A Discord.js Guild object.
 * @return the number of GuildMembers we checked.
 */
async function assignRolesInGuild(guild) {
	// TODO how will we handle more than 1000 users? Do we need a special
	// API permission for this?
	const members = await guild.members.fetch();

	// TODO check if guild is available before doing this. (in guild?)
	await Promise.all(members.map(member => {
		logger.debug(`Checking ${detail(member)}`);

		return assignRolesFromPresence(member.presence, true);
	}));

	return members.size;
}

/**
 * Assigns or removes the "Now Playing" role from the GuildMember in the given
 * Presence object, as applicable.
 *
 * @param presence  A GuildMember's Discord.js Presence object.
 */
async function assignRolesFromPresence(presence) {
	if (
		presence.activities.find(activity =>
			activity.applicationID === CONFIG.halo_app_id)
		&& presence.status !== 'offline' && presence.status !== 'dnd'
	) {
		await addRole(presence);
	}
	else {
		await removeRole(presence);
	}
}

/**
 * Adds the Guild-specific "Now Playing" role to the GuildMember in the given
 * Presence object.
 * This function is effectively a no-op if the member already has the role.
 *
 * @param presence  A GuildMember's Discord.js Presence object.
 */
async function addRole(presence) {
	const role = await getPlayingRoleForGuild(presence.guild);
	const member = await presence.guild.members.fetch(presence.userID);

	if (member.roles.cache.has(role.id)) {
		return;
	}

	try {
		await member.roles.add(role);

		logger.info(`Assigned role (${role.id}) to ${detail(member)}`);
	}
	catch (err) {
		logger.warn(
			`Error adding role (${role.id}) to ${detail(member)}\n` + err.stack
		);
	}
}

/**
 * Removes the Guild-specific "Now Playing" role from the GuildMember in the
 * given Presence object.
 * This function is effectively a no-op if the member does not have the role.
 *
 * @param presence  A GuildMember's Discord.js Presence object.
 */
async function removeRole(presence) {
	const role = await getPlayingRoleForGuild(presence.guild);
	const member = await presence.guild.members.fetch(presence.userID);

	if (!member.roles.cache.has(role.id)) {
		return;
	}

	try {
		await member.roles.remove(role);

		logger.info(`Removed role (${role.id}) from ${detail(member)}`);
	}
	catch (err) {
		logger.warn(
			`Error removing role (${role.id}) from ${detail(member)}\n`
			+ err.stack
		);
	}
}

/**
 * Given a GuildMember, returns a string describing their name, ID, and which
 * guild they're in. This is helpful for logging for tracing production issues.
 *
 * @param member  A Discord.js GuildMember object.
 * @return string.
 */
function detail(member) {
	// Should never happen, but let's handle this case anyway.
	if (!member) {
		return "[undefined]";
	}

	return `"${member.user.tag}" (${member.user.id}) ` +
		`in "${member.guild.name}" (${member.guild.id})`;
}

/**
 * Returns the "Now Playing" role for the given Guild, if it has one. Can return
 * undefined if we cannot find the role even after an API fetch.
 *
 * @param guild  A Discord.js Guild object.
 * @return A Discord.js Role object, or undefined.
 */
async function getPlayingRoleForGuild(guild) {
	let role = guild.roles.cache.find(role => role.name === ROLE_NAME);

	if (!role) {
		await guild.roles.fetch();
		role = guild.roles.cache.find(role => role.name === ROLE_NAME);
	}

	if (!role) { // Still
		logger.warn(
			`Failed to find "${ROLE_NAME}" role in "${guild.name}" (${guild.id}).`
			+ ' The role may have been deleted or renamed.'
		);

		// TODO message guild owner?
	}

	return role;
}
