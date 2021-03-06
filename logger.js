/*******************************************************************************
 * This file is part of PlayingBot, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * PlayingBot is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const Winston = require('winston');

const LOG_FILE_NAME = 'output.log';
const IS_PROD = process.env.NODE_ENV === 'prod';


let logger = Winston.createLogger();

let logFormat = Winston.format.combine(
	Winston.format.timestamp(),
	Winston.format.printf( ({ level, message, timestamp }) => {
		return `${timestamp} [${level}]: ${message}`;
	}),
);

logger.add(new Winston.transports.File({
	filename: LOG_FILE_NAME,
	format: logFormat,
	level: 'info',
}));
logger.add(new Winston.transports.Console({
	format: Winston.format.combine(
		Winston.format.colorize(),
		logFormat,
	),
	level: IS_PROD ? 'error' : 'info',
}));


// Rolling our own unhandled exception and Promise rejection handlers, because
// Winston's built-in ones kind of suck.
function errStr(err) {
	return err instanceof Error ? err.stack : err;
}
process.on('uncaughtExceptionMonitor', err => logger.error(errStr(err)));
process.on('unhandledRejection',
	err => logger.warn(`Unhandled Promise rejection: ${errStr(err)}`));


module.exports = logger;
