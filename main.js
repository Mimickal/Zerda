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
async function onReady() {
	logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);

	await createRoleAll();
	await assignRolesAll();
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

	createPlayingRole(guild);
}

/// Events.GUILD_DELETE event handler
function onGuildLeave(guild) {
	logger.info(`Left guild "${guild.name}" (${guild.id})`);
}

/**
 * Applies createPlayingRole to every guild this bot can see.
 */
async function createRoleAll() {
	logger.info(`Checking all guilds for "${ROLE_NAME}" role...`);
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
	let role = guild.roles.cache.find(role => role.name === ROLE_NAME);
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
 * Applies assignRolesFromPresence to every guild member this bot can see,
 * across all guilds.
 * This also effectively builds out the live cache of players.
 */
async function assignRolesAll() {
	logger.info("Beginning initial member check...");
	let guildCount = 0;
	let memberCount = 0;

	for await (let guild of client.guilds.cache.values()) {
		// TODO how will we handle more than 1000 users? Do we need a special
		// API permission for this?
		let members = await guild.members.fetch();

		guildCount++;
		memberCount += members.size;

		await Promise.all(members.map(member => {
			logger.debug(`Checking ${detail(member)}`);
			return assignRolesFromPresence(member.presence, true);
		}));
	}


	logger.info("Finished initial member check. " +
		`Checked ${memberCount} members across ${guildCount} guilds`);
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
	else if (nocache || player_map.has(presence.userID)) {
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
