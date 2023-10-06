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

enum SignalEmoji {
	Bad  = ':no_entry',
	Meh  = ':ok:',
	Good = ':white_check_mark:',
}

export const UNKNOWN_ERR_MSG = 'Something went wrong. I logged the issue so someone can fix it.';

export async function badReply(
	interaction: CommandInteraction,
	message: string,
): Promise<void> {
	await reply(interaction, SignalEmoji.Bad, message);
}

export async function goodReply(
	interaction: CommandInteraction,
	message: string,
): Promise<void> {
	await reply(interaction, SignalEmoji.Good, message);
}

export async function mehReply(
	interaction: CommandInteraction,
	message: string,
): Promise<void> {
	await reply(interaction, SignalEmoji.Meh, message);
}

export async function unknownErrorReply(
	interaction: CommandInteraction,
): Promise<void> {
	await reply(interaction, SignalEmoji.Bad, UNKNOWN_ERR_MSG);
}

async function reply(
	interaction: CommandInteraction,
	emoji: SignalEmoji,
	message: string,
): Promise<void> {
	const content = `${emoji} ${message}`;
	logger.info(`Reply to ${detail(interaction)}: ${content}`);
	await interaction.reply({
		content: content,
		ephemeral: true,
	});
}
