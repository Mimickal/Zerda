/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
import {
	Application,
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	CommandInteraction,
	CommandInteractionOption,
	DiscordAPIError,
	RESTJSONErrorCodes,
	Snowflake,
} from 'discord.js';
import {
	getApplication,
	requireAdmin,
	requireGuild,
	SlashCommandRegistry,
	WithGuild,
} from 'discord-command-registry';

import * as database from './database';
const logger = require('./logger');
import { assignRoleAllMembers } from './role';
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
			// FIXME requireAdmin may imply requireGuild, but the types on
			// requireGuild don't, mostly because I forgot to change that.
			// When that is fixed in discord-command-registry, update this too.
			.setHandler(requireAdmin(requireGuild(handlerAppAdd), handlerNotAdmin))
			.addStringOption(option => option
				.setName(APP_ID)
				.setDescription('A game (aka application) ID')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('remove')
			.setDescription('Stop tracking playing status for an application')
			// FIXME see above.
			.setHandler(requireAdmin(requireGuild(handlerAppRemove), handlerNotAdmin))
			.addStringOption(option => option
				.setName(APP_ID)
				.setDescription('A game (aka application) ID')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('list')
			.setDescription('List all applications tracked on this server')
			.setHandler(requireGuild(handlerAppList))
		)
	);
export default COMMANDS;

/** Handler for unknown commands (default handler). */
async function handlerDefault(interaction: CommandInteraction): Promise<void> {
	logger.warn(`Unimplemented ${detail(interaction)}`);
	await interaction.reply({
		content: "Sorry, I don't know how to do this yet. It's probably coming soon!",
		ephemeral: true,
	});
}

/** Handler when a non-admin attempts to run a privileged command. */
async function handlerNotAdmin(interaction: CommandInteraction): Promise<void> {
	logger.info(`${detail(interaction.member)} is not an admin`);
	await interaction.reply({
		content: `${EMOJI_BAD} Sorry, only admins can use this command.`,
		ephemeral: true,
	});
}

/** Info command handler. Prints bot version, source code, and some fun stats. */
async function handlerInfo(interaction: CommandInteraction): Promise<void> {
	await interaction.reply(
		`I am a ${PACKAGE.description}.\n` +
		`**Running version:** ${PACKAGE.version}\n` +
		`**Source code:** ${PACKAGE.repository.url}\n`
	);
}

/**
 * App add command handler. Adds the given app to the app list for the guild
 * this command came from.
 */
async function handlerAppAdd(
	interaction: WithGuild<ChatInputCommandInteraction>,
): Promise<void> {
	const app = await smartGetApplication(interaction);
	if (!app) {
		return;
	}

	try {
		await database.addAppToServer(interaction.guild.id, app.id);
	} catch (err: unknown) {
		if (errCodeEquals(err, 'SQLITE_CONSTRAINT')) {
			logger.info(`${detail(interaction.guild)} already has ${detail(app)}`);
			await interaction.reply({
				content: `${EMOJI_MEH} Already tracking ${detail(app)} in this server`,
				ephemeral: true,
			});
		} else {
			logger.error(`${detail(interaction)} addAppToServer() failed`, err);
			await interaction.reply({
				content: `${EMOJI_BAD} ${UNKNOWN_ERR_MSG}`,
				ephemeral: true,
			});
		}
		return;
	}

	logger.info(`Added ${detail(app)} to ${detail(interaction.guild)}`);
	logger.info(`Checking all members of ${detail(interaction.guild)} for added app`);
	await Promise.all([
		interaction.reply(`${EMOJI_GOOD} Now tracking ${detail(app)}`),
		assignRoleAllMembers(interaction.guild),
	]);
}

/// Stop tracking command handler
async function handlerAppRemove(
	interaction: WithGuild<ChatInputCommandInteraction>,
): Promise<void> {
	const app = await smartGetApplication(interaction);
	if (!app) {
		return;
	}

	let removed;
	try {
		removed = await database.removeAppFromServer(interaction.guild.id, app.id);
	} catch (err) {
		logger.error(`${detail(interaction)} removeAppFromServer() failed`, err);
		await interaction.reply({
			content: `${EMOJI_BAD} ${UNKNOWN_ERR_MSG}`,
			ephemeral: true,
		});
		return;
	}

	if (removed) {
		logger.info(`Removed ${detail(app)} from ${detail(interaction.guild)}`);
		logger.info(`Checking all members of ${detail(interaction.guild)} for removed app`);
		await Promise.all([
			interaction.reply(`${EMOJI_GOOD} Stopped tracking ${detail(app)}`),
			assignRoleAllMembers(interaction.guild),
		]);
	} else {
		logger.info(`${detail(interaction.guild)} doesn't have ${detail(app)}`);
		await interaction.reply({
			content: `${EMOJI_MEH} I wasn't tracking ${detail(app)} in this server`,
			ephemeral: true,
		});
	}
}

/// List apps command handler
async function handlerAppList(
	interaction: WithGuild<ChatInputCommandInteraction>,
): Promise<void> {
	let app_ids: Snowflake[];
	try {
		app_ids = await database.getAppsInServer(interaction.guild.id);
	} catch (err) {
		logger.error(`${detail(interaction)} getAppsInServer() failed`, err);
		await interaction.reply({
			content: `${EMOJI_BAD} ${UNKNOWN_ERR_MSG}`,
			ephemeral: true,
		});
		return;
	}

	const apps = await Promise.all(app_ids.map(app_id => {
		// Dirty hack. getApplication in discord-command-registry takes an
		// interaction, not an ID, so we'll add the ID to the interaction.
		const optionWithAppId: CommandInteractionOption = {
			name: APP_ID,
			type: ApplicationCommandOptionType.String,
			value: app_id,
		};
		// @ts-expect-error _hoistedOptions is private
		interaction.options._hoistedOptions = [optionWithAppId];
		return smartGetApplication(interaction);
	}));

	if (apps.length === 0) {
		await interaction.reply('I am not tracking any apps in this server yet!');
	} else {
		// TODO this can hit the max message length limit
		await interaction.reply(
			'I am tracking these apps in this server:\n' +
			apps
				.filter((app): app is Application => !!app)
				.map(app => `- ${app.name} (${app.id})\n`)
		);
	}
}

/**
 * Fetches an application in an interaction. Logs and responds to the
 * interaction if the lookup fails for some reason.
 */
async function smartGetApplication(
	interaction: ChatInputCommandInteraction,
): Promise<Application | undefined> {
	try {
		return await getApplication(interaction, APP_ID);
	} catch (err: unknown) {
		let reason: string | undefined;

		// FIXME actually handle these errors.
		// Maybe pull this to discord-command-registry.
		if (errCodeEquals(err, RESTJSONErrorCodes.InvalidFormBodyOrContentType)) {
			console.log('invalidform', err);
			reason = (err as DiscordAPIError).name;
				//.rawError.errors.application_id._errors[0].message;
		}

		if (errCodeEquals(err, RESTJSONErrorCodes.UnknownApplication)) {
			console.log('unknown app', err);
			//reason = err.rawError.message;
		}

		const baseMSg = `${detail(interaction)} getApplication() failed`;
		if (reason) {
			logger.info(`${baseMSg}: ${(err as Error).message}`);
		} else {
			logger.error(`${baseMSg} with unhandled error`, err);
		}

		await interaction.reply({
			content: `${EMOJI_BAD} ${reason ?? UNKNOWN_ERR_MSG}`,
			ephemeral: true,
		});
	}
}

/**
 * Helper for checking the code on an Error.
 *
 * `code` is not a standard field on Error. I'm not sure where it's coming from
 * at runtime, but most errors from knex have a code.
 */
function errCodeEquals(err: unknown, code: unknown): boolean {
	return !!(err &&
		typeof err === 'object' &&
		'code' in err &&
		err.code === code);
}
