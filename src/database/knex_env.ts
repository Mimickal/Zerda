/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
// @ts-expect-error Knex needs this to be a JS file. We only use it here.
import knexfile from './knexfile';
import setupKnex from 'knex';
const knex = setupKnex(knexfile);
export default knex;
