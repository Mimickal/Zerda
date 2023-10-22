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

import { Config, Package } from './config';

// Need to setup logger before loading modules that use it.
const logger = createLogger({ filename: Config.log_file });
GlobalLogger.setGlobalLogger(logger);

import * as events from './events';

// Set up the Discord client
const client = new Discord.Client({
	presence: {
		activities: [{
			name: `Version ${Package.version}`,
			type: Discord.ActivityType.Playing,
		}],
	},
	intents: [
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

logger.info(startupMsg(Package.version, Config));

client.login(Config.token).catch(err => {
	logger.error('Failed to log in!', err);
	process.exit(1);
});
