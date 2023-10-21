/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
import {
	Client,
	Guild,
	GuildMember,
	PermissionsBitField,
	PresenceStatus,
	Role,
} from 'discord.js';
import { detail, GlobalLogger } from '@mimickal/discord-logging';

import { ROLE_NAME } from './config';
import * as database from './database';

const logger = GlobalLogger.logger;

// TODO there are surely some redundant operations in here.
// We're fetching the role for every user we check in the guild.
// We could absolutely just pull that role early on, then pass it down the call
// chains. Same with the database calls (though these should be fast anyway).

/**
 * Applies {@link createPlayingRole} to every Guild this bot can see.
 */
export async function createPlayingRoleAllGuilds(client: Client): Promise<void> {
	logger.info(`Checking all guilds for "${ROLE_NAME}" role...`);
	// TODO do we need to await this? We can probably do all of these at once.
	for (const guild of client.guilds.cache.values()) {
		await createPlayingRole(guild);
	}
}

/**
 * Creates the {@link ROLE_NAME} role in the given Guild, if it doesn't already
 * exist.
 */
export async function createPlayingRole(guild: Guild): Promise<void> {
	let role = await getPlayingRole(guild);
	if (role) {
		logger.debug(`${detail(guild)} already has ${detail(role)}`);
		return;
	}

	try {
		role = await guild.roles.create({
			hoist: true, // VERY IMPORTANT! This bot doesn't work without this!
			name: ROLE_NAME,
			permissions: new PermissionsBitField(),
			position: 0,
			reason: 'Role for people currently playing',
		});

		logger.info(`Created ${detail(role)} in ${detail(guild)}`);
	} catch (err) {
		logger.warn(`Error creating Role "${ROLE_NAME}" in ${detail(guild)}`, err);
		// TODO probably message guild owner
	}
}


/**
 * Applies {@link assignRoleAllMembers} to every GuildMember this bot can see,
 * across all Guilds. We do one Guild at a time, which combined with Discord's
 * rate limit can make this operation take some time to complete.
 */
export async function assignRoleAllGuilds(client: Client): Promise<void> {
	logger.info('Beginning initial member check...');
	const startTime = Date.now();
	let guildCount = 0;
	let memberCount = 0;

	for (const guild of client.guilds.cache.values()) {
		guildCount++;
		const progress = `(${guildCount}/${client.guilds.cache.size})`;
		const count = await assignRoleAllMembers(guild, progress);
		memberCount += count;
	}

	const timeTaken = Date.now() - startTime;
	logger.info('Finished initial member check. ' +
		`Checked ${memberCount} members across ${guildCount} guilds ` +
		`in ${timeTaken} ms`
	);
}

/**
 * Applies {@link assignRole} to every GuildMember in the given Guild.
 * We are limited by Discord's API rate limit, so this can take some time to
 * complete.
 *
 * @return the number of GuildMembers we checked.
 */
export async function assignRoleAllMembers(guild: Guild, progress = ''): Promise<number> {
	logger.info(`Beginning member check in ${detail(guild)} ${progress}`);
	const startTime = Date.now();

	// Apparently Discord.js really will just fetch thousands of members at once.
	const members = await guild.members.fetch({ withPresences: true });
	let processed = 0;

	for (const member of members.values()) {
		processed++;

		logger.debug(`Checking ${detail(member)} in ${detail(guild)}`);
		await assignRole(member);

		// Don't log on last iteration. It's redundant with the "finish" log.
		if (processed % 50 === 0 && processed < members.size) {
			logger.debug(
				`Checked ${processed}/${members.size} members in ${detail(guild)}`
			);
		}
	}

	const timeSpent = Date.now() - startTime;
	logger.info(
		`Finished member check in ${detail(guild)}. ` +
		`Checked ${members.size} members in ${timeSpent} ms ${progress}`
	);

	return members.size;
}

/**
 * Assigns or removes the {@link ROLE_NAME} role to or from the given
 * GuildMember, as applicable.
 */
export async function assignRole(member: GuildMember): Promise<void> {
	try {
		if (await shouldAssignRole(member)) {
			await addRole(member);
		} else {
			await removeRole(member);
		}
	} catch (err) {
		logger.error('Something went wrong in shouldAssignRole()', err);
		await removeRole(member); // Fail safe
	}
}

/**
 * Checks a GuildMember's presence to see if we should give them the playing role.
 */
async function shouldAssignRole(member: GuildMember): Promise<boolean> {
	const presence = member.presence;

	// Check this stuff first to possibly short-circuit before database lookup.
	// Presence can be null for offline members.
	const ignoredStatus = Array.of<PresenceStatus>('dnd', 'offline', 'invisible');
	if (!presence || ignoredStatus.includes(presence.status)) {
		return false;
	}

	// Make caller deal with any error thrown here
	const server_apps = await database.getAppsInServer(member.guild.id);

	// Make this O(n^2) operation short-circuit as soon as possible.
	const presence_app_set = new Set(
		presence.activities.map(act => act.applicationId)
	);
	return !!server_apps.find(app_id => presence_app_set.has(app_id));
}

/**
 * Adds the Guild-specific {@link ROLE_NAME} role to the given GuildMember.
 * This function is effectively a no-op if the member already has the role.
 */
async function addRole(member: GuildMember): Promise<void> {
	const role = await getPlayingRole(member.guild);

	if (!role) {
		return; // TODO handle this better
	}

	if (member.roles.cache.has(role.id)) {
		logger.debug(`${detail(member)} already has ${detail(role)}`);
		return;
	}

	try {
		await member.roles.add(role);
		await database.incrementAssignCounter();
		logger.info(`Assigned ${detail(role)} to ${detail(member)}`);
	} catch (err) {
		logger.warn(`Error assigning ${detail(role)} to ${detail(member)}`, err);
	}
}

/**
 * Removes the Guild-specific {@link ROLE_NAME} role from the given GuildMember.
 * This function is effectively a no-op if the member does not have the role.
 */
async function removeRole(member: GuildMember): Promise<void> {
	const role = await getPlayingRole(member.guild);

	if (!role) {
		return; // TODO handle this better
	}

	if (!member.roles.cache.has(role.id)) {
		return;
	}

	try {
		await member.roles.remove(role);
		logger.info(`Removed ${detail(role)} from ${detail(member)}`);
	} catch (err) {
		logger.warn(`Error removing ${detail(role)} from ${detail(member)}`, err);
	}
}

/**
 * Returns the {@link ROLE_NAME} role for the given Guild, if it has one.
 * Can return `undefined` if we cannot find the role even after an API fetch.
 */
async function getPlayingRole(guild: Guild): Promise<Role | undefined> {
	await guild.roles.fetch();
	const role = guild.roles.cache.find(role => role.name === ROLE_NAME);

	if (role) {
		return role;
	}

	logger.warn(
		`Failed to find "${ROLE_NAME}" role in ${detail(guild)}.`
		+ ' The role may have been deleted or renamed.'
	);
}
