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

// TODO temporary easy stuff for testing.
const TOKEN = fs.readFileSync(process.argv[2]).toString().trim();
const CONFIG = require('./config.json');

// TODO handle sharding if we want this in multiple servers
/// The Discord bot client.
const client = new Discord.Client();

/**
 * Cache of GuildMembers we have assigned a "Now Playing" role.
 * This allows us to cut down on the number of Discord API calls we need to do.
 */
const player_map = new Map();

// TODO on guild join, create the halo role if it doesn't exist
const Events = Discord.Constants.Events;
client.on(Events.CLIENT_READY, onReady);
client.on(Events.PRESENCE_UPDATE, onPresenceUpdate);


// TODO we need legit logging
// TODO also, alerting for when we log an error

client.login(TOKEN).catch(err => {
	console.error(err);
	process.exit(1);
});


/// Events.CLIENT_READY event handler
function onReady() {
	console.log(`Logged in as ${client.user.tag}`);

	assignRolesAll();
}

/// Events.PRESENCE_UPDATE event handler
function onPresenceUpdate(old_presence, new_presence) {
	assignRolesFromPresence(new_presence);
}

// TODO error checking for all this stuff
// TODO check for permissions and API failures

/**
 * Applies assignRolesFromPresence to every guild member this bot can see.
 * This also effectively builds out the live cache of players.
 */
async function assignRolesAll() {
	let guild = await client.guilds.fetch(CONFIG.server_id);
	let members = await guild.members.fetch();

	members.each(member => {
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
	let user = await presence.guild.members.fetch(userID);

	await user.roles.add(CONFIG.halo_role_id);

	player_map.set(userID, user);
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
	let user = player_map.get(userID);

	if (nocache) {
		user = await presence.guild.members.fetch(userID);
	}

	await user.roles.remove(CONFIG.halo_role_id);

	player_map.delete(userID);
}
