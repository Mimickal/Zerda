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

// TODO handle sharding if we want this in multiple servers
const client = new Discord.Client();

/**
 * Cache of GuildMembers we have assigned a "Now Playing" role.
 * This allows us to cut down on the number of Discord API calls we need to do.
 */
const player_map = new Map();

// Set up the Discord client
// TODO on guild join, create the halo role if it doesn't exist
const Events = Discord.Constants.Events;
client.on(Events.CLIENT_READY, onReady);
client.on(Events.PRESENCE_UPDATE, onPresenceUpdate);
client.on(Events.GUILD_CREATE, onGuildJoin);
client.on(Events.GUILD_DELETE, onGuildLeave);


// TODO we need legit logging
// TODO also, alerting for when we log an error

client.login(TOKEN).catch(err => {
	logger.error(err.stack);
	process.exit(1);
});


/// Events.CLIENT_READY event handler
function onReady() {
	logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);

	assignRolesAll();
}

/// Events.PRESENCE_UPDATE event handler
function onPresenceUpdate(old_presence, new_presence) {
	assignRolesFromPresence(new_presence);
}

// TODO error checking for all this stuff
// TODO check for permissions and API failures
/// Events.GUILD_CREATE event handler
function onGuildJoin(guild) {
	logger.info(`Joined guild "${guild.name}" (${guild.id}) with permissions ${
		guild.member(client.user.id).permissions.bitfield
	}`);
}

/// Events.GUILD_DELETE event handler
function onGuildLeave(guild) {
	logger.info(`Left guild "${guild.name}" (${guild.id})`);
}

/**
 * Applies assignRolesFromPresence to every guild member this bot can see.
 * This also effectively builds out the live cache of players.
 */
async function assignRolesAll() {
	let guild = await client.guilds.fetch(CONFIG.server_id);
	let members = await guild.members.fetch();

	logger.info("Beginning initial member check...");
	members.each(member => {
		logger.debug(`Checking ${detail(member)}`);
		assignRolesFromPresence(member.presence, true);
	});
}

/**
 * Assigns or removes the "Now Playing" role from the GuildMember in the given
 * Presence object, as applicable. Updates the cache as needed.
 *
 * @param presence  A GuildMember's Discord.js Presence object.
 * @param nocache   Passed through to <code>removeRole</code>.
 */
function assignRolesFromPresence(presence, nocache) {
	if (presence.activities.find(activity =>
		activity.applicationID === CONFIG.halo_app_id
	)) {
		addRole(presence);
	}
	else if (nocache || player_map.has(presence.userID)) {
		removeRole(presence, nocache);
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
	let member = await presence.guild.members.fetch(userID);

	await member.roles.add(CONFIG.halo_role_id);

	if (!member.roles.cache.has(CONFIG.halo_role_id)) {
		logger.info(`Assigned role ${CONFIG.halo_role_id} to ${detail(member)}`);
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
	let member = player_map.get(userID);

	if (nocache) {
		member = await presence.guild.members.fetch(userID);
	}

	await member.roles.remove(CONFIG.halo_role_id);

	if (member.roles.cache.has(CONFIG.halo_role_id)) {
		logger.info(`Removed role ${CONFIG.halo_role_id} from ${detail(member)}`);
	}
	player_map.delete(userID);
}

/**
 * Given a GuildMember, returns a string describing their name, ID, and which
 * guild they're in. This is helpful for logging for tracing production issues.
 */
function detail(member) {
	// Should never happen, but let's handle this case anyway.
	if (!member) {
		return "[undefined]";
	}

	return `"${member.user.tag}" (${member.user.id}) ` +
		`in "${member.guild.name}" (${member.guild.id})`;
}
