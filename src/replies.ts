/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
import { GlobalLogger, detail } from '@mimickal/discord-logging';
import { CommandInteraction } from 'discord.js';

const logger = GlobalLogger.logger;

interface ReplyOpts {
	edit?: boolean;
	ephemeral?: boolean;
	followUp?: boolean;
};

enum SignalEmoji {
	Bad  = ':no_entry:',
	Meh  = ':information_source:',
	Good = ':white_check_mark:',
}

export const UNKNOWN_ERR_MSG = 'Something went wrong. I logged the issue so someone can fix it.';

export async function badReply(
	interaction: CommandInteraction,
	message: string,
	opts?: ReplyOpts,
): Promise<void> {
	await reply(interaction, SignalEmoji.Bad, message, opts);
}

export async function goodReply(
	interaction: CommandInteraction,
	message: string,
	opts?: ReplyOpts,
): Promise<void> {
	await reply(interaction, SignalEmoji.Good, message, opts);
}

export async function mehReply(
	interaction: CommandInteraction,
	message: string,
	opts?: ReplyOpts,
): Promise<void> {
	await reply(interaction, SignalEmoji.Meh, message, opts);
}

export async function unknownErrorReply(
	interaction: CommandInteraction,
	opts?: ReplyOpts,
): Promise<void> {
	await reply(interaction, SignalEmoji.Bad, UNKNOWN_ERR_MSG, opts);
}

async function reply(
	interaction: CommandInteraction,
	emoji: SignalEmoji,
	message: string,
	opts?: ReplyOpts,
): Promise<void> {
	const content = `${emoji} ${message}`;
	const ephemeral = opts?.ephemeral ?? true;

	let action: string;
	let replyPromise: Promise<unknown>;

	if (opts?.edit) {
		action = 'Editing reply';
		replyPromise = interaction.editReply({ content });
	} else if (opts?.followUp) {
		action = 'Following up';
		replyPromise = interaction.followUp({ content, ephemeral });
	} else {
		action = 'Reply';
		replyPromise = interaction.reply({ content, ephemeral });
	}

	logger.info(`${action} to ${detail(interaction)}: ${content}`);
	await replyPromise;
}
