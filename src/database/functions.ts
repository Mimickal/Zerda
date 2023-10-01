/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
import { Snowflake } from 'discord.js';

import knex from './knex_env';

enum Table {
	Apps = 'apps',
}

const GUILD_ID = 'guild_id' as const;
const APP_ID = 'app_id' as const;

interface App {
	[GUILD_ID]: Snowflake;
	[APP_ID]: Snowflake;
}

/** Adds a new application to track for a server. */
export async function addAppToServer(
	guild_id: Snowflake,
	app_id: Snowflake,
): Promise<void> {
	validateDiscordId(guild_id, GUILD_ID);
	validateDiscordId(app_id, APP_ID);

	await knex<App>(Table.Apps).insert({ guild_id, app_id });
}

/** Gets all the applications tracked for a server. */
export async function getAppsInServer(
	guild_id: Snowflake,
): Promise<Snowflake[]> {
	validateDiscordId(guild_id, GUILD_ID);

	const rows = await knex<App>(Table.Apps)
		.select(APP_ID)
		.where(GUILD_ID, guild_id);

	return rows.map(row => row[APP_ID]);
}

/** Removes an application from being tracked in a server. */
export async function removeAppFromServer(
	guild_id: Snowflake,
	app_id: Snowflake,
): Promise<number> {
	validateDiscordId(guild_id, GUILD_ID);
	validateDiscordId(app_id, APP_ID);

	return await knex<App>(Table.Apps)
		.where({ guild_id, app_id })
		.delete();
}

// Not a perfect implementation, but good enough for our purposes.
function validateDiscordId(value: unknown, name: string): void {
	if (typeof value !== 'string' || !value.match(/\d+/)) {
		throw new Error(`${name} is not a Discord ID: ${value}`);
	}
}
