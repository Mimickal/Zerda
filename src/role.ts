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
	Snowflake,
} from 'discord.js';
import { detail, GlobalLogger } from '@mimickal/discord-logging';

import { ROLE_NAME } from './config';
import * as database from './database';

const logger = GlobalLogger.logger;

/**
 * Data we can pass down these call chains to reduce the number of database and
 * Discord API calls we need to make (mostly saves us from needing to re-fetch
 * a guild's playing role).
 *
 * Doing this makes the code a little messier, but *dramatically* speeds up
 * execution time. We're talking from ~7 minutes down to ~500 milliseconds for
 * a guild containing ~2700 members.
 */
interface GuildCache {
	role?: Role;
	apps?: Set<Snowflake>;
}

/**
 * Applies {@link assignRoleAllMembers} and {@link createPlayingRole} to every
 * Guild and GuildMember this bot can see. We do one Guild at a time, which
 * combined with Discord's rate limit can make this operation take some time to
 * complete.
 */
export async function checkAllGuilds(client: Client): Promise<void> {
	logger.info('Beginning initial check...');
	const startTime = Date.now();
	let guildCount = 0;
	let memberCount = 0;

	for (const guild of client.guilds.cache.values()) {
		guildCount++;

		const progress = `(${guildCount}/${client.guilds.cache.size})`;
		const role = await createPlayingRole(guild);
		const apps = new Set(await database.getAppsInServer(guild.id));

		const count = await assignRoleAllMembers(guild, { apps, progress, role });

		memberCount += count;
	}

	const timeTaken = Date.now() - startTime;
	logger.info(
		`Finished initial check - ${memberCount} members ` +
		`across ${guildCount} guilds in ${timeTaken} ms`
	);
}

/**
 * Creates the {@link ROLE_NAME} role in the given Guild, if it doesn't already
 * exist.
 *
 * @returns the role.
 */
export async function createPlayingRole(guild: Guild): Promise<Role | undefined> {
	let role = await getPlayingRole(guild);
	if (role) {
		logger.debug(`${detail(guild)} already has ${detail(role)}`);
		return role;
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

	return role;
}

/**
 * Applies {@link assignRole} to every GuildMember in the given Guild.
 * We are limited by Discord's API rate limit, so this can take some time to
 * complete.
 *
 * @return the number of GuildMembers we checked.
 */
export async function assignRoleAllMembers(
	guild: Guild,
	cache?: GuildCache & { progress?: string },
): Promise<number> {
	const progress = cache?.progress ?? '';
	logger.info(`Beginning member check in ${detail(guild)} ${progress}`);
	const startTime = Date.now();

	const role = cache?.role ?? await getPlayingRole(guild);
	const apps = cache?.apps ?? new Set(await database.getAppsInServer(guild.id));

	// Apparently Discord.js really will just fetch thousands of members at once.
	const members = await guild.members.fetch({ withPresences: true });
	let processed = 0;

	for (const member of members.values()) {
		processed++;

		logger.debug(`Checking ${detail(member)} in ${detail(guild)}`);
		await assignRole(member, { apps, role });

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
export async function assignRole(member: GuildMember, cache?: GuildCache): Promise<void> {
	const role = cache?.role ?? await getPlayingRole(member.guild);

	try {
		if (await shouldAssignRole(member, cache?.apps)) {
			await addRole(member, role);
		} else {
			await removeRole(member, role);
		}
	} catch (err) {
		logger.error('Something went wrong in shouldAssignRole()', err);
		await removeRole(member, role); // Fail safe
	}
}

/**
 * Checks a GuildMember's presence to see if we should give them the playing role.
 */
async function shouldAssignRole(member: GuildMember, apps?: Set<Snowflake>): Promise<boolean> {
	const presence = member.presence;

	// Check this stuff first to possibly short-circuit before database lookup.
	// Presence can be null for offline members.
	const ignoredStatus = Array.of<PresenceStatus>('dnd', 'offline', 'invisible');
	if (!presence || ignoredStatus.includes(presence.status)) {
		return false;
	}

	// Make caller deal with any error thrown here
	const server_apps = apps ?? new Set(await database.getAppsInServer(member.guild.id));
	return !!presence.activities.find(act => server_apps.has(act.applicationId!));
}

/**
 * Adds the Guild-specific {@link ROLE_NAME} role to the given GuildMember.
 * This function is effectively a no-op if the member already has the role.
 */
async function addRole(member: GuildMember, cachedRole?: Role): Promise<void> {
	const role = cachedRole ?? await getPlayingRole(member.guild);

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
async function removeRole(member: GuildMember, cachedRole?: Role): Promise<void> {
	const role = cachedRole ?? await getPlayingRole(member.guild);

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

	// TODO what happens if we can't find this role?
	// Make this function take a "expect_Missing" field for first-time running

	logger.warn(
		`Failed to find "${ROLE_NAME}" role in ${detail(guild)}.`
		+ ' The role may have been deleted or renamed.'
	);
}
