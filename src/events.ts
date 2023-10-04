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
	Message,
	Presence,
} from 'discord.js';

import commands from './commands';
const logger = require('./logger');
import {
	assignRoleAllGuilds,
	assignRole,
	createPlayingRoleAllGuilds,
	createPlayingRole,
	assignRoleAllMembers,
} from './role';
const { detail } = require('./util');

/**
 * {@link Events.ClientReady} event handler.
 */
export async function onReady(client: Client): Promise<void> {
	logger.info(`Logged in as ${detail(client.user)}`);

	// TODO catch error if we don't have permissions
	await createPlayingRoleAllGuilds(client);
	await assignRoleAllGuilds(client);
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
	// TODO probably clear config for guild.
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

/**
 * {@link Discord.Events.MessageCreate} event handler.
 *
 * We don't actually do anything with messages, but it's useful to log DMs anyway.
 */
export async function onMessage(msg: Message): Promise<void> {
	// TODO we might consider not doing this, for GDPR reasons.
	if (msg.channel.isDMBased()) {
		logger.info(`Received DM from ${detail(msg.author)}: ${msg.content}`);
		return;
	}
}
