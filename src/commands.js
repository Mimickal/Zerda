/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const { APIErrors } = require('discord.js').Constants;
const {
	Options,
	SlashCommandRegistry,
} = require('discord-command-registry');

const database = require('./database');
const logger = require('./logger');
const { detail } = require('./util');

const APP_ID = 'application-id';
const EMOJI_BAD = ':no_entry:';
const EMOJI_MEH = ':ok:';
const EMOJI_GOOD = ':white_check_mark:';
const UNKNOWN_ERR_MSG = "Something went wrong. I logged the issue so someone can fix it.";
const PACKAGE = require('../package.json');

const COMMANDS = new SlashCommandRegistry()
	.setDefaultHandler(handlerDefault)
	.addCommand(command => command
		.setName('info')
		.setDescription('Prints details about the bot')
		.setHandler(handlerInfo)
	)
	.addCommand(command => command
		.setName('app')
		.setDescription('Modify applications the bot tracks in this server')
		.addSubcommand(subcommand => subcommand
			.setName('add')
			.setDescription('Track playing status for a new application')
			.setHandler(handlerAppAdd)
			.addStringOption(option => option
				.setName(APP_ID)
				.setDescription('A game (aka application) ID')
				.setRequired(true)
			)
		)
	);

/// Unknown command handler
function handlerDefault(interaction) {
	logger.warn(`Unimplemented ${detail(interaction)}`);
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

/// Start tracking command handler
async function handlerAppAdd(interaction) {
	let app;
	try {
		app = await Options.getApplication(interaction, APP_ID);
	} catch (err) {
		let reason;

		if (err.code === APIErrors.INVALID_FORM_BODY) {
			reason = err.rawError.errors.application_id._errors[0].message;
		}
		if (err.code === APIErrors.UNKNOWN_APPLICATION) {
			reason = err.rawError.message;
		}

		const base = `${detail(interaction)} getApplication() failed`;
		if (reason) {
			logger.info(`${base}: ${err.toString()}`);
		} else {
			logger.error(`${base} with unhandled error: ${err.toString()}`);
		}

		return interaction.reply({
			content: `${EMOJI_BAD} ${reason ?? UNKNOWN_ERR_MSG}`,
			ephemeral: true,
		});
	}

	try {
		await database.addAppToServer(interaction.guild.id, app.id);
	} catch (err) {
		if (err.code === 'SQLITE_CONSTRAINT') {
			logger.info(`${detail(interaction.guild)} already has ${detail(app)}`);
			return interaction.reply({
				content: `${EMOJI_MEH} Already tracking ${detail(app)} in this server`,
				ephemeral: true,
			});
		}

		logger.error(`${detail(interaction)} addAppToServer() failed: ${err.toString()}`);
		return interaction.reply({
			content: `${EMOJI_BAD} ${UNKNOWN_ERR_MSG}`,
			ephemeral: true,
		});
	}

	logger.info(`Added ${detail(app)} to ${detail(interaction.guild)}`);
	return interaction.reply(`${EMOJI_GOOD} Now tracking ${detail(app)}`)
}

module.exports = COMMANDS;
