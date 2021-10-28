/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const knex = require('knex')(require('./knexfile'));
const { Snowflake } = require('discord.js'); // For VSCode intellisense

const APPS = 'apps';
const GUILD_ID = 'guild_id';
const APP_ID = 'app_id';

/**
 * Adds a new application to track for a server.
 * @param {Snowflake} guild_id A Discord Guild ID.
 * @param {Snowflake} application_id A Discord Application ID.
 * @throws {Error} For invalid Guild or Application IDs.
 * @returns {Promise<*>} Resolved value not meaningful.
 */
async function addAppToServer(guild_id, application_id) {
	validateDiscordId(guild_id, 'guild_id');
	validateDiscordId(application_id, 'application_id');

	return knex(APPS).insert({
		[GUILD_ID]: guild_id,
		[APP_ID]: application_id,
	});
}

/**
 * Gets all the applications tracked for a server.
 * @param {Snowflake} guild_id A Discord Guild ID.
 * @throws {Error} For invalid Guild ID.
 * @returns {Promise<Snowflake[]>} Resolves to array of Discord Application IDs.
 */
async function getAppsInServer(guild_id) {
	validateDiscordId(guild_id, 'guild_id');

	return knex(APPS)
		.select(APP_ID)
		.where(GUILD_ID, guild_id)
		.then(rows => rows.map(row => row[APP_ID]));
}

/**
 * Removes an application from being tracked in a server.
 * @param {Snowflake} guild_id A Discord Guild ID.
 * @param {Snowflake} application_id A Discord Application ID.
 * @throws {Error} For invalid Guild or Application IDs.
 * @returns {Promise<Number>} Resolves to number of deleted rows.
 */
async function removeAppFromServer(guild_id, application_id) {
	validateDiscordId(guild_id, 'guild_id');
	validateDiscordId(application_id, 'application_id');

	return knex(APPS).where({
		[GUILD_ID]: guild_id,
		[APP_ID]: application_id,
	}).delete();
}

// Not a perfect implementation, but good enough for our purposes.
function validateDiscordId(value, name) {
	if (!value.match(/\d+/)) {
		throw new Error(`${name} is not a Discord ID: ${value}`);
	}
}

module.exports = {
	addAppToServer,
	getAppsInServer,
	removeAppFromServer,
};
