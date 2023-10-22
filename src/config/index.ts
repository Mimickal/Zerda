/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/

// Keep this in sync with the export of env.js.
// Use type instead of interface to satisfy Record<string, unknown>.
type EnvConfig = {
	PROJECT_ROOT: string;
	application_id: string;
	database_file: string;
	guild_id: string | undefined;
	log_file: string;
	token: string;
}

// Keep this in sync with package.json
interface PackConfig {
	description: string;
	homepage: string;
	version: string;
}

// Knex cannot load config from TypeScript, so we leave the environment config
// as JavaScript and add type information in this file.
export const Config: EnvConfig = require('./env');

// Add type information to the fields we care about in package.json
const pack_json = require('../../package.json');
export const Package: PackConfig = {
	description: pack_json.description,
	homepage: pack_json.homepage,
	version: pack_json.version,
};

export const ROLE_NAME = 'Currently Playing' as const;