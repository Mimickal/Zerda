/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const Discord = require('discord.js');

const commands = require('./commands');
const config = require('./config');
const database = require('./database');
const logger = require('./logger');
const { detail } = require('./util');

// TODO temporary easy stuff for testing.
const CONFIG = require('../config.json'); // Needed until app ID isn't hard-coded
const PACKAGE = require('../package.json');
const ROLE_NAME = 'Currently Playing';

// TODO this is getting big like the logger. Maybe pull this out to its own file
// Set up the Discord client
const Intents = Discord.Intents.FLAGS;
const client = new Discord.Client({
	presence: {
		activities: [{
			type: Discord.Constants.ActivityTypes.LISTENING,
			name: `'help' for commands. Running version ${PACKAGE.version}`,
		}],
	},
	intents: [
		Intents.DIRECT_MESSAGES, // Unused, but useful for logging
		Intents.GUILDS,
		Intents.GUILD_MEMBERS,
		Intents.GUILD_MESSAGES,  // This is going to be an issue soon
		Intents.GUILD_PRESENCES,
	],
});

const Events = Discord.Constants.Events;
client.on(Events.CLIENT_READY, onReady);
client.on(Events.PRESENCE_UPDATE, onPresenceUpdate);
client.on(Events.GUILD_CREATE, onGuildJoin);
client.on(Events.GUILD_DELETE, onGuildLeave);
client.on(Events.INTERACTION_CREATE, onInteraction);
client.on(Events.MESSAGE_CREATE, onMessage);


// TODO Log if we ever message someone.
// TODO check fo API failures (like we can't contact Discord)

logger.info('Logging in...');
client.login(config.token).catch(err => {
	logger.error(err.stack);
	process.exit(1);
});


/// Events.CLIENT_READY event handler
async function onReady() {
	logger.info(`Logged in as ${detail(client.user)}`);

	// TODO catch error if we don't have permissions
	await createRoleAll();
	await assignRolesAll();
}

/// Events.PRESENCE_UPDATE event handler
function onPresenceUpdate(old_presence, new_presence) {
	assignRolesToMember(new_presence.member);
}

/// Events.GUILD_CREATE event handler
async function onGuildJoin(guild) {
	logger.info(`Joined ${detail(guild)} with permissions ${
		guild.member(client.user.id).permissions.bitfield
	}`);

	await createPlayingRole(guild);
	await assignRolesInGuild(guild);
}

/// Events.GUILD_DELETE event handler
function onGuildLeave(guild) {
	logger.info(`Left ${detail(guild)}`);
}

/// Events.INTERACTION_CREATE event handler
async function onInteraction(interaction) {
	if (!interaction.isCommand()) {
		return;
	}

	logger.info(`${detail(interaction)} by ${detail(interaction.member)}...`);
	try {
		await commands.execute(interaction);
	} catch (err) {
		logger.warn(`${detail(interaction)} error fell through: ${err.toString()}`);
	}
}

/// Events.MESSAGE_CREATE event handler
// We don't actually do anything with messages, but it's useful to log DMs anyway.
function onMessage(msg) {
	if (msg.channel instanceof Discord.DMChannel) {
		logger.info(`Received DM from ${detail(msg.author)}: ${msg.content}`);
		return;
	}
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
		logger.debug(`${detail(guild)} already has ${detail(role)}`);
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

		logger.info(`Created ${detail(role)} in ${detail(guild)}`);
	}
	catch (err) {
		logger.warn(
			`Error creating Role "${ROLE_NAME}" in ${detail(guild)}\n`
			+ err.stack
		);

		// TODO probably message guild owner
	}
}

/**
 * Applies assignRolesToMember to every GuildMember this bot can see,
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
 * Applies assignRolesToMember to every GuildMember in the given Guild.
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

		return assignRolesToMember(member);
	}));

	return members.size;
}

/**
 * Assigns or removes the "Now Playing" role to or from the given GuildMember,
 * as applicable.
 *
 * @param member  A Discord.js GuildMember object.
 */
async function assignRolesToMember(member) {
	try {
		if (await shouldAssignRole(member)) {
			await addRole(member);
		} else {
			await removeRole(member);
		}
	} catch (err) {
		logger.error('Something went wrong in shouldAssignRole():', err);
		await removeRole(member); // Fail safe
	}
}

// Checks a GuildMember's presence to see if we should give them the playing role.
async function shouldAssignRole(member) {
	const presence = member.presence;

	// Check this stuff first to possibly short-circuit before database lookup.
	// Presence can be null for offline members.
	if (!presence || Array.of('dnd', 'offline').includes(presence.status)) {
		return false;
	}

	// Make caller deal with any error thrown here
	const server_apps = await database.getAppsInServer(member.guild.id);
	const presence_app_map = new Map(
		presence.activities.map(act => [act.applicationId, true])
	);

	// Make this O(n^2) operation short-circuit as soon as possible.
	return !!server_apps.find(app_id => presence_app_map.get(app_id));
}

/**
 * Adds the Guild-specific "Now Playing" role to the given GuildMember.
 * This function is effectively a no-op if the member already has the role.
 *
 * @param member  A Discord.js GuildMember object.
 */
async function addRole(member) {
	const role = await getPlayingRoleForGuild(member.guild);

	if (member.roles.cache.has(role.id)) {
		logger.info(`${detail(member)} already has ${detail(role)}`);
		return;
	}

	try {
		await member.roles.add(role);

		logger.info(`Assigned ${detail(role)} to ${detail(member)}`);
	}
	catch (err) {
		logger.warn(
			`Error assigning ${detail(role)} to ${detail(member)}\n` + err.stack
		);
	}
}

/**
 * Removes the Guild-specific "Now Playing" role from the given GuildMember.
 * This function is effectively a no-op if the member does not have the role.
 *
 * @param member  A Discord.js GuildMember object.
 */
async function removeRole(member) {
	const role = await getPlayingRoleForGuild(member.guild);

	if (!member.roles.cache.has(role.id)) {
		return;
	}

	try {
		await member.roles.remove(role);

		logger.info(`Removed ${detail(role)} from ${detail(member)}`);
	}
	catch (err) {
		logger.warn(
			`Error removing ${detail(role)} from ${detail(member)}\n`
			+ err.stack
		);
	}
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
			`Failed to find "${ROLE_NAME}" role in ${detail(guild)}.`
			+ ' The role may have been deleted or renamed.'
		);

		// TODO message guild owner?
	}

	return role;
}
