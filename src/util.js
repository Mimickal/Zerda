/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const Discord = require('discord.js');

/**
 * Given a Discord.js object, returns a string describing it in better detail.
 * This is helpful for logging so we can better trace production issues.
 *
 * Currently supported:
 *   GuildMember, Guild, Role, User
 *
 * @param thing  A supported Discord.js object.
 * @return string describing the thing.
 */
function detail(thing) {
	// Should never happen, but let's handle this case anyway.
	if (!thing) {
		return "[undefined]";
	}

	if (thing instanceof Discord.GuildMember) {
		const member = thing;
		let string = `Member "${member.user.tag}" `;
		if (member.nickname) {
			string += `[${member.nickname}] `;
		}
		return string + `in "${member.guild.name}" (${member.guild.id})`;
	}
	else if (thing instanceof Discord.Guild) {
		const guild = thing;
		return `Guild "${guild.name}" (${guild.id})`;
	}
	else if (thing instanceof Discord.Role) {
		const role = thing;
		return `Role "${role.name}" (${role.id})`;
	}
	else if (thing instanceof Discord.User) {
		const user = thing;
		return `User "${user.tag}" (${user.id})`;
	}
	else if (thing instanceof Discord.CommandInteraction) {
		const interaction = thing;
		return Array.of(
			interaction.commandName,
			interaction.options.getSubcommandGroup(false),
			interaction.options.getSubcommand(false)
		).filter(x => x).join(' ');
	}
	else {
		throw Error("Unsupported type " + typeof(thing));
	}
}

module.exports = {
	detail,
};

