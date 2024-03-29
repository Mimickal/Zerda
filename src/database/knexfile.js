/*******************************************************************************
 * This file is part of Zerda, a role-assigning Discord bot.
 * Copyright (C) 2020 Mimickal (Mia Moretti).
 *
 * Zerda is free software under the GNU Affero General Public License v3.0.
 * See LICENSE or <https://www.gnu.org/licenses/agpl-3.0.en.html> for more
 * information.
 ******************************************************************************/
const config = require('../config/env');

// Paths are all relative to this JS file.
module.exports = {
	client: 'sqlite3',
	connection: {
		filename: config.database_file,
	},
	migrations: {
		directory: './migrations',
	},
	useNullAsDefault: true,
};
