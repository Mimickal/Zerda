/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const APPS = 'apps';
const META = 'meta';

// ID lengths have slowly increased from 17 to 20 over the past 6 years,
// so let's just use a bigger number and never worry about it again.
const ID_LEN = 30;

exports.up = async function(knex) {
	await knex.schema.createTable(APPS, table => {
		table.string('guild_id', ID_LEN).notNullable();
		table.string('app_id',   ID_LEN).notNullable();

		table.primary(['guild_id', 'app_id']);
	});

	await knex.schema.createTable(META, table => {
		table.integer('assignments').notNullable();
	});

	// There will only ever be one row in this table, so we make it here.
	await knex(META).insert({ assignments: 0 });
};

exports.down = async function(knex) {
	await knex.schema.dropTableIfExists(APPS);
	await knex.schema.dropTableIfExists(META);
};

