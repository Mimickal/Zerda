/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
import {
	BaseInteraction,
	Client,
	Events,
	Guild,
	Presence,
} from 'discord.js';
import { detail, GlobalLogger, loginMsg } from '@mimickal/discord-logging';

import commands from './commands';
import * as database from './database';
import {
	checkAllGuilds,
	assignRole,
	createPlayingRole,
	assignRoleAllMembers,
} from './role';

const logger = GlobalLogger.logger;

/**
 * {@link Events.ClientReady} event handler.
 */
export async function onReady(client: Client): Promise<void> {
	if (!client.user) {
		logger.error('Somehow logged in with null client user. Stopping.');
		process.exit(1);
	}

	logger.info(loginMsg(client.user));

	// TODO catch error if we don't have permissions
	await checkAllGuilds(client);
}

/**
 * {@link Events.PresenceUpdate} event handler.
 */
export async function onPresenceUpdate(
	old_presence: Presence | null,
	new_presence: Presence,
): Promise<void> {
	if (!new_presence.member) {
		logger.debug(`Skipping presence update with null member (User ID: ${
			new_presence.userId
		})`);
		return;
	}

	await assignRole(new_presence.member);
}

/**
 * {@link Events.GuildCreate} event handler.
 *
 * Creates the necessary playing role and scans for people to assign it to.
 */
export async function onGuildJoin(guild: Guild): Promise<void> {
	const clientMember = await guild.members.fetch(guild.client.user);
	logger.info(`Joined ${detail(guild)} with permissions ${
		clientMember.permissions.bitfield
	}`);

	await createPlayingRole(guild);
	await assignRoleAllMembers(guild);
}

/**
 * {@link Discord.Events.GuildDelete} event handler.
 */
export async function onGuildLeave(guild: Guild): Promise<void> {
	logger.info(`Left ${detail(guild)}`);
	await database.clearServerConfig(guild.id);
}

/**
 * {@link Discord.Events.InteractionCreate} event handler.
 */
export async function onInteraction(interaction: BaseInteraction): Promise<void> {
	if (!interaction.isCommand()) {
		return;
	}

	logger.info(`${detail(interaction)} by ${detail(interaction.member)}...`);
	try {
		await commands.execute(interaction);
	} catch (err) {
		logger.error(`${detail(interaction)} error fell through`, err);
	}
}
