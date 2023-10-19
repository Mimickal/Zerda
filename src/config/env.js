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
		'\t--app     The bot application ID.\n' +
		'\t--config  Use this JSON config file instead of the default.\n' +
		'\t--dbfile  The SQLite3 database file to use.\n' +
		'\t--guild   A Discord guild ID. Causes commands to be registered for\n' +
		'\t          just this guild. If unset, commands are registered globally.\n' +
		'\t--logfile The log file to use.\n' +
		'\t--token   A file containing a bot token.\n' +
		'\t--help    Show this help text and exit.\n' +
		'\t--version Show bot version and exit.\n'
	);
	process.exit(0);
}

const PROJECT_ROOT = fs.realpathSync(path.join(__dirname, '..', '..'));

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
if (cli_args.version) {
	const package = require('../../package.json');
	console.log(package.version);
	process.exit(0);
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
	cli_args.app ??
	conf.app     ??
	process.env.ZERDA_APP;

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
	cli_args.guild ??
	conf.guild     ??
	process.env.ZERDA_GUILD_ID;

/**
 * The log output file for the bot. If this is not set, a local dev log is
 * used instead.
 */
let log_file =
	cli_args.logfile          ??
	conf.log_file             ??
	process.env.ZERDA_LOGFILE ??
	'dev.log';
if (!path.isAbsolute(log_file)) {
	log_file = path.resolve(PROJECT_ROOT, log_file);
}

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
	PROJECT_ROOT: PROJECT_ROOT,
	application_id: application_id,
	database_file: database_file,
	guild_id: guild_id,
	log_file: log_file,
	token: token,
});
