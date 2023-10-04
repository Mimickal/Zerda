/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
import * as Discord from 'discord.js';

const config = require('./config');
import * as events from './events';
const logger = require('./logger');

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
// TODO standard login message
logger.info('Logging in...');
client.login(config.token).catch(err => {
	logger.error(err.stack);
	process.exit(1);
});
