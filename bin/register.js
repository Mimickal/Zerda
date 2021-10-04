const fs = require('fs');
const minimist = require('minimist');
const commands = require('../src/commands');

const args = minimist(process.argv.slice(2), {
	string: ['app', 'guild'],
});

console.log(
	`Registering commands for application '${args.app}' ` +
	(args.guild ? `in guild '${args.guild};` : 'GLOBALLY') +
	` using token file '${args.token}'...\n`
);

commands.registerCommands({
	application_id: args.app,
	token: fs.readFileSync(args.token).toString().trim(),
	guild: args.guild,
}).then(data => {
	console.log('Registration successful! Got back data\n', data);
}).catch(err => {
	console.log('Something went wrong!\n\n', err);
	process.exit(1);
});

