/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const {
	Constants,
	Permissions,
} = require('discord.js');
const { APIErrors } = Constants;
const {
	Options,
	SlashCommandRegistry,
} = require('discord-command-registry');

const database = require('./database');
const logger = require('./logger');
const main = require('./main'); // FIXME this is gross, pull out to events file
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
		.addSubcommand(subcommand => subcommand
			.setName('remove')
			.setDescription('Stop tracking playing status for an application')
			.setHandler(handlerAppRemove)
			.addStringOption(option => option
				.setName(APP_ID)
				.setDescription('A game (aka application) ID')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('list')
			.setDescription('List all applications tracked on this server')
			.setHandler(handlerAppList)
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
	const reply = enforceAdmin(interaction)

	if (reply) {
		return reply;
	}

	let app = await smartGetApplication(interaction);

	if (!app) {
		return;
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
	logger.info(`Checking all members of ${detail(interaction.guild)} for added app`);
	return Promise.all([
		interaction.reply(`${EMOJI_GOOD} Now tracking ${detail(app)}`),
		main.assignRolesInGuild(interaction.guild),
	]);
}

/// Stop tracking command handler
async function handlerAppRemove(interaction) {
	const reply = enforceAdmin(interaction)

	if (reply) {
		return reply;
	}

	const app = await smartGetApplication(interaction);

	if (!app) {
		return;
	}

	let removed;
	try {
		removed = await database.removeAppFromServer(interaction.guild.id, app.id);
	} catch (err) {
		logger.error(`${detail(interaction)} removeAppFromServer() failed: ${err.toString()}`);
		return interaction.reply({
			content: `${EMOJI_BAD} ${UNKNOWN_ERR_MSG}`,
			ephemeral: true,
		});
	}

	if (removed) {
		logger.info(`Removed ${detail(app)} from ${detail(interaction.guild)}`);
		logger.info(`Checking all members of ${detail(interaction.guild)} for removed app`);
		return Promise.all([
			interaction.reply(`${EMOJI_GOOD} Stopped tracking ${detail(app)}`),
			main.assignRolesInGuild(interaction.guild),
		]);
	} else {
		logger.info(`${detail(interaction.guild)} doesn't have ${detail(app)}`);
		return interaction.reply({
			content: `${EMOJI_MEH} I wasn't tracking ${detail(app)} in this server`,
			ephemeral: true,
		});
	}
}

/// List apps command handler
async function handlerAppList(interaction) {
	let app_ids;
	try {
		app_ids = await database.getAppsInServer(interaction.guild.id);
	} catch (err) {
		logger.error(`${detail(interaction)} getAppsInServer() failed: ${err.toString()}`);
		return interaction.reply({
			content: `${EMOJI_BAD} ${UNKNOWN_ERR_MSG}`,
			ephemeral: true,
		});
	}

	const apps = await Promise.all(app_ids.map(app_id => {
		// Dirty hack. Options.getApplication takes an interaction, not an ID.
		interaction.options._hoistedOptions = [{
			name: APP_ID,
			type: 'STRING',
			value: app_id,
		}];
		return smartGetApplication(interaction);
	}));

	if (apps.length === 0) {
		return interaction.reply('I am not tracking any apps in this server yet!');
	} else {
		// TODO this can hit the max message length limit
		return interaction.reply(
			'I am tracking these apps in this server:\n' +
			apps.map(app => `- ${app.name} (${app.id})\n`)
		);
	}
}

// Checks that the interaction's member has permission to issue a command
function enforcePermission(interaction) {
	if (interaction.member.permissions.has(Permissions.FLAGS.ADMINISTRATOR)) {
		return;
	}

	logger.info(`${detail(interaction.member)} is not an admin`);
	return interaction.reply({
		content: `${EMOJI_BAD} Sorry, only admins can use this command.`,
		ephemeral: true,
	});
}

// Fetches an application in an interaction, logging and responding to the
// interaction if the lookup fails for some reason.
async function smartGetApplication(interaction) {
	try {
		return await Options.getApplication(interaction, APP_ID);
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
}

module.exports = COMMANDS;
