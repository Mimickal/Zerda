/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const Discord = require('discord.js');
const { SlashCommandRegistry } = require('discord-command-registry');

const logger = require('./logger');
const { detail } = require('./util');

const PACKAGE = require('../package.json');
const COMMANDS = new SlashCommandRegistry()
	.setDefaultHandler(handlerDefault)
	.addCommand(command => command
		.setName('info')
		.setDescription('Prints details about the bot')
		.setHandler(handlerInfo)
	);

/// Unknown command handler
function handlerDefault(interaction) {
	logger.info(`Unrecognized command: ${detail(interaction)}`);
	return interaction.reply(
		"Sorry, I don't know how to do this yet. It's probably coming soon!"
	);
}

/// Info command handler
function handlerInfo(interaction) {
	return interaction.reply(
		`I am a ${PACKAGE.description}.\n` +
		`**Running version:** ${PACKAGE.version}\n` +
		`**Source code:** ${PACKAGE.repository.url}\n`
	);
}


module.exports = COMMANDS;
