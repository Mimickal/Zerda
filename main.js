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
const client = new Discord.Client();
const player_map = new Map();

// TODO on guild join, create the halo role if it doesn't exist
const Events = Discord.Constants.Events;
client.on(Events.CLIENT_READY, onReady);
client.on(Events.PRESENCE_UPDATE, onPresenceUpdate);


// TODO we need legit logging

client.login(TOKEN).catch(err => {
	console.error(err);
	process.exit(1);
});


function onReady() {
	console.log(`Logged in as ${client.user.tag}`);

	assignRolesAll();
}

function onPresenceUpdate(old_presence, new_presence) {
	assignRolesFromPresence(new_presence);
}

// TODO error checking for all this stuff
async function assignRolesAll() {
	let guild = await client.guilds.fetch(CONFIG.server_id);
	let members = await guild.members.fetch();

	members.each(member => {
		assignRolesFromPresence(member.presence, true);
	});
}

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

async function addRole(presence) {
	let userID = presence.userID;
	let user = await presence.guild.members.fetch(userID);

	await user.roles.add(CONFIG.halo_role_id);

	player_map.set(userID, user);
}

async function removeRole(presence, nocache) {
	let userID = presence.userID;
	let user = player_map.get(userID);

	if (nocache) {
		user = await presence.guild.members.fetch(userID);
	}

	await user.roles.remove(CONFIG.halo_role_id);

	player_map.delete(userID);
}
