/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const Discord = require('discord.js');
const {
	Argument,
	Command,
	CommandRegistry,
} = require('positional-args');
const logger = require('./logger');
const { detail } = require('./util');

const PACKAGE = require('../package.json');
const COMMANDS = new CommandRegistry()
	.defaultHandler(handlerDefault)
	.helpHandler(handlerHelp)
	.add(new Command('info')
		.description('Show info about the bot')
		.handler(handlerInfo)
	);

/// Essentially the Events.MESSAGE_CREATE event handler.
async function handleCommandMessage(client, msg) {
	// Ignore DMs
	if (msg.channel instanceof Discord.DMChannel) {
		logger.info(`Received DM from ${detail(msg.author)}: ${msg.content}`);
		return;
	}

	// Ignore messages that don't mention us first
	const msg_parts = Command.split(msg.content);
	const mention = msg_parts.shift(); // Remove possible bot mention
	if (!mention || !mention.includes(client.user.id)) {
		return;
	}

	try {
		const msg_text = msg_parts.join(' ');
		logger.info(`Command by ${detail(msg.member)}: ${msg_text}`);
		await COMMANDS.execute(msg_text, msg);
	} catch (cmderr) {
		logger.warn(
			`Command ${cmderr.command.name} failed: ${cmderr.full_message}`
		);
	}
}

/// Unknown command handler
function handlerDefault(args, msg) {
	logger.info(`Possible unrecognized command: ${msg.content}`);
}

/// Help command handler
function handlerHelp(args, commands, msg) {
	const embed = new Discord.MessageEmbed()
		.setTitle('Commands Help');

	const addCommandToEmbed = (command) => embed.addField(
		`\`${command.usage()}\``, command.getDescription()
	);

	if (args.command) {
		if (!commands.has(args.command)) {
			return msg.reply(`I don't have a command named \`${args.command}\``);
		}
		addCommandToEmbed(commands.get(args.command));
	} else {
		commands.forEach(command => addCommandToEmbed(command));
	}

	return msg.reply(embed);
}

/// Info command handler
function handlerInfo(args, msg) {
	return msg.reply(
		`I am a ${PACKAGE.description}.\n` +
		`**Running version:** ${PACKAGE.version}\n` +
		`**Source code:** ${PACKAGE.homepage}\n`
	);
}

module.exports = handleCommandMessage;

