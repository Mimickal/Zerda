/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
import * as Discord from 'discord.js';
import { createLogger, GlobalLogger, startupMsg } from '@mimickal/discord-logging';

const config = require('./config');

// Need to setup logger before loading modules that use it.
const logger = createLogger({ filename: config.log_file });
GlobalLogger.setGlobalLogger(logger);

import * as events from './events';

// TODO move this to config
const PACKAGE = require('../package.json');

// Set up the Discord client
const client = new Discord.Client({
	presence: {
		activities: [{
			name: `Version ${PACKAGE.version}`,
			type: Discord.ActivityType.Playing,
		}],
	},
	intents: [
		Discord.GatewayIntentBits.DirectMessages, // Unused, but useful for logging
		Discord.GatewayIntentBits.Guilds,
		Discord.GatewayIntentBits.GuildMembers,
		Discord.GatewayIntentBits.GuildPresences,
	],
});

client.on(Discord.Events.ClientReady, events.onReady);
client.on(Discord.Events.PresenceUpdate, events.onPresenceUpdate);
client.on(Discord.Events.GuildCreate, events.onGuildJoin);
client.on(Discord.Events.GuildDelete, events.onGuildLeave);
client.on(Discord.Events.InteractionCreate, events.onInteraction);
client.on(Discord.Events.MessageCreate, events.onMessage);


// TODO Log if we ever message someone.
// TODO check fo API failures (like we can't contact Discord)
logger.info(startupMsg(PACKAGE.version, config));

client.login(config.token).catch(err => {
	logger.error('Failed to log in!', err);
	process.exit(1);
});
