const commands = require('../src/commands');
const config = require('../src/config');

console.log(
	`Registering commands for application '${config.application_id}' ` +
	(config.guild_id ? `in guild '${config.guild_id}'` : 'GLOBALLY') + '...\n'
);

commands.registerCommands({
	application_id: config.application_id,
	guild: config.guild_id,
	token: config.token,
}).then(data => {
	console.log('Registration successful! Got back data\n', data);
}).catch(err => {
	console.log('Something went wrong!\n\n', err);
	process.exit(1);
});
