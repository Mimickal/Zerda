/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
// This is the one-stop-shop for all bot config. Config priority:
// 1. CLI arguments
// 2. CLI JSON config file
// 3. Local JSON config file
// 4. Environment variables
const fs = require('fs');
const minimist = require('minimist');
const path = require('path');

function usage() {
	console.log('Usage:\n\n' +
		'\tapp     The bot application ID.\n' +
		'\tconfig  Use this JSON config file instead of the default.\n' +
		'\tdbfile  The SQLite3 database file to use.\n' +
		'\tguild   A Discord guild ID. Causes commands to be registered for\n' +
		'\t        just this guild. If unset, commands are registered globally.\n' +
		'\ttoken   A file containing a bot token.\n' +
		'\thelp    Show this help text and exit.\n'
	);
	process.exit(0);
}

const PROJECT_ROOT = fs.realpathSync(path.join(__dirname, '..'));

// This two-part parse silliness lets us provide args during knex commands using
// double-double dashes (e.g. -- -- --some-option)
let cli_args = minimist(process.argv.slice(2), {
	string: ['app', 'guild'],
});
const leftover = cli_args._;
delete cli_args._;
cli_args = {
	...cli_args,
	...minimist(leftover),
};

if (cli_args.help) {
	usage();
}

// Load config relative to project root, since knex overrides cwd
let conf_file =
	cli_args.config          ??
	process.env.ZERDA_CONFIG ??
	'config.json';
if (!path.isAbsolute(conf_file)) {
	conf_file = path.resolve(PROJECT_ROOT, conf_file);
}
const conf = require(conf_file);

/**
 * The application ID of the bot. This is typically the Discord bot user's ID.
 */
const application_id =
	cli_args.app        ??
	conf.application_id ??
	process.env.ZERDA_APP_ID;

/**
 * The SQLite3 database file for the bot. If this is not set, a local dev
 * database is used instead.
 *
 * Can be provided during knex commands using double-double dashes, e.g.:
 * npm knex run migrate:latest -- -- --dbfile something
 */
let database_file =
	cli_args.dbfile            ??
	conf.database_file         ??
	process.env.ZERDA_DATABASE ??
	'dev.sqlite3';
if (database_file && !path.isAbsolute(database_file)) {
	database_file = path.resolve(PROJECT_ROOT, database_file);
}

/**
 * A guild ID to register commands for. This is only really useful for
 * registering commands for a single guild, during testing.
 */
const guild_id =
	cli_args.guild     ??
	conf.test_guild_id ??
	process.env.ZERDA_GUILD_ID;

/**
 * The bot's Discord token, used for log in.
 * This one's a little weird. The CLI arg points to a file, but the other
 * settings set the token directly.
 */
let token;
if (cli_args.token) {
	token = fs.readFileSync(args.token);
} else if (conf.token) {
	token = conf.token;
} else if (process.env.ZERDA_TOKEN) {
	token = process.env.ZERDA_TOKEN;
}

module.exports = Object.freeze({
	application_id: application_id,
	database_file: database_file,
	guild_id: guild_id,
	token: token,
});
