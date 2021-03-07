/*******************************************************************************
 * This file is part of PlayingBot, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * PlayingBot is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const fs = require('fs');
const Discord = require('discord.js');

const logger = require('./logger.js');

// TODO temporary easy stuff for testing.
const TOKEN = fs.readFileSync(process.argv[2]).toString().trim();
const CONFIG = require('./config.json');
const ROLE_NAME = 'Currently Playing';

// TODO handle sharding if we want this in multiple servers
const client = new Discord.Client();

/**
 * Cache of GuildMembers we have assigned a "Now Playing" role.
 * This allows us to cut down on the number of Discord API calls we need to do.
 */
const player_map = new Map();

// Set up the Discord client
const Events = Discord.Constants.Events;
client.on(Events.CLIENT_READY, onReady);
client.on(Events.PRESENCE_UPDATE, onPresenceUpdate);
client.on(Events.GUILD_CREATE, onGuildJoin);
client.on(Events.GUILD_DELETE, onGuildLeave);


// TODO we need legit logging
//  - Wrap any discord API action. Log to warn on fail.
//		- Not logging, but we might consider messaging a guild owner when the
//		bot fails to do something for permissions reasons.
//
//  - Log if we ever message someone.
//

// TODO error checking for Discord API calls
// TODO check for permissions and API failures
// TODO alerting for when we log an error

client.login(TOKEN).catch(err => {
	logger.error(err.stack);
	process.exit(1);
});


/// Events.CLIENT_READY event handler
async function onReady() {
	logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);

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
	for await (let guild of client.guilds.cache.values()) {
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
	let role = getPlayingRoleForGuild(guild);
	if (role) {
		logger.debug(
			`Guild ${guild.name} (${guild.id}) already has role ${role.id}`
		);
		return;
	}

	role = await guild.roles.create({
		data: {
			hoist: true, // VERY IMPORTANT! This bot doesn't work without this!
			mentionable: true,
			name: ROLE_NAME,
			permissions: 0,
			position: 0, // TODO mention in readme that people will want to reorder this
		},
		reason: 'Role for people currently playing',
	});

	logger.info(`Created role ${role.id} in guild "${guild.name}" (${guild.id})`);
}

/**
 * Applies assignRolesFromPresence to every GuildMember this bot can see,
 * across all Guilds. We do one Guild at a time, which combined with Discord's
 * rate limit can make this operation take some time to complete.
 *
 * This also effectively builds out the live cache of players.
 */
async function assignRolesAll() {
	logger.info("Beginning initial member check...");
	let guildCount = 0;
	let memberCount = 0;

	for await (let guild of client.guilds.cache.values()) {
		let count = await assignRolesInGuild(guild);
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
	let members = await guild.members.fetch();

	// TODO check if guild is available before doing this. (in guild?)
	await Promise.all(members.map(member => {
		logger.debug(`Checking ${detail(member)}`);
		return assignRolesFromPresence(member.presence, true);
	}));

	return members.size;
}

/**
 * Assigns or removes the "Now Playing" role from the GuildMember in the given
 * Presence object, as applicable. Updates the cache as needed.
 *
 * @param presence  A GuildMember's Discord.js Presence object.
 * @param nocache   Passed through to <code>removeRole</code>.
 */
async function assignRolesFromPresence(presence, nocache) {
	if (presence.activities.find(activity =>
		activity.applicationID === CONFIG.halo_app_id
	)) {
		await addRole(presence);
	}
	else if (
		   nocache
		|| player_map.has(presence.userID)
		|| presence.status === 'offline'
		|| presence.status === 'dnd'
	) {
		await removeRole(presence, nocache);
	}
}

/**
 * Adds the Guild-specific "Now Playing" role to the GuildMember in the given
 * Presence object. Also stores that GuildMember in our cache.
 *
 * This function is effectively a no-op if the member already has the role.
 *
 * @param presence  A GuildMember's Discord.js Presence object.
 */
async function addRole(presence) {
	let userID = presence.userID;
	let roleID = getPlayingRoleForGuild(presence.guild).id;
	let member = await presence.guild.members.fetch(userID);

	await member.roles.add(roleID);

	if (!member.roles.cache.has(roleID)) {
		logger.info(`Assigned role ${roleID} to ${detail(member)}`);
	}
	player_map.set(userID, member);
}

/**
 * Removes the Guild-specific "Now Playing" role from the GuildMember in the
 * given Presence object. Also removes that GuildMember from our cache.
 *
 * This function is effectively a no-op if the member does not have the role.
 *
 * @param presence  A GuildMember's Discord.js Presence object.
 * @param nocache   Disables using our cached GuildMember. If true, this will
 *                  force a member fetch from Discord's API.
 */
async function removeRole(presence, nocache) {
	let userID = presence.userID;
	let roleID = getPlayingRoleForGuild(presence.guild).id;
	let member = player_map.get(userID);

	if (nocache || !member) {
		member = await presence.guild.members.fetch(userID);
	}

	// TODO catch the exception here
	await member.roles.remove(roleID);

	if (member.roles.cache.has(roleID)) {
		logger.info(`Removed role ${roleID} from ${detail(member)}`);
	}
	player_map.delete(userID);
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
 * Returns the "Now Playing" role for the given Guild, if it has one.
 *
 * @param guild  A Discord.js Guild object.
 * @return A Discord.js Role object.
 */
function getPlayingRoleForGuild(guild) {
	return guild.roles.cache.find(role => role.name === ROLE_NAME);
}
