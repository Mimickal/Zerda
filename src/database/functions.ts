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
	Meta = 'meta',
}

const APP_ID = 'app_id' as const;
const ASSIGNMENTS = 'assignments' as const;
const GUILD_ID = 'guild_id' as const;

interface App {
	[APP_ID]: Snowflake;
	[GUILD_ID]: Snowflake;
}

interface Meta {
	[ASSIGNMENTS]: number;
}

interface Stats {
	apps: number;
	assignments: number;
	guilds: number;
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

/** Increments the role assignment counter. */
export async function incrementAssignCounter(amount?: number): Promise<void> {
	await knex<Meta>(Table.Meta)
		.increment(ASSIGNMENTS, amount ?? 1);
}

/**
 * Returns some meta stats about the bot.
 *   - guilds:      number of guilds the bot is active in.
 *   - apps:        number of applications the bot is tracking (per-guild).
 *   - assignments: number of times the playing role has been assigned.
 */
export async function getMetaStats(): Promise<Stats> {
	const guilds = ((await knex<App>(Table.Apps)
		.countDistinct(GUILD_ID, { as: 'guilds' })
		.first())
		?.guilds ?? 0) as number;

	const apps = ((await knex<App>(Table.Apps)
		.count('*', { as: 'apps' })
		.first())
		?.apps ?? 0) as number;

	const assignments = (await knex<Meta>(Table.Meta)
		.select(ASSIGNMENTS)
		.first())
		?.[ASSIGNMENTS] ?? 0;

	return {
		apps,
		assignments,
		guilds
	};
}

// Not a perfect implementation, but good enough for our purposes.
function validateDiscordId(value: unknown, name: string): void {
	if (typeof value !== 'string' || !value.match(/\d+/)) {
		throw new Error(`${name} is not a Discord ID: ${value}`);
	}
}
