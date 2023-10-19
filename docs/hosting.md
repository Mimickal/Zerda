# Hosting your own instance

Zerda is [Libre software](https://en.wikipedia.org/wiki/Free_software). You are
welcome to download the source code and run your own, private instance of the
bot (as long as you follow the terms of the [AGPLv3 license](../LICENSE.md)).
It's easier than it looks. This guide is just long because there are several
options for hosting.

Zerda is built on Discord.js v14, which requires Node.js 16.11.0 or newer.
Zerda is also written in TypeScript, and runs directly using `ts-node`.
*We do not transpile to JavaScript*.

If this is an issue, Docker configuration is also provided for running the bot
in a container.

# Bot Setup

1. Create a [Discord application](https://discord.com/developers/applications),
   and add a bot to it. Save the token it gives you.
1. Create a `config.json` file in the project root with the following:
   ```json
   {
     "app": "your application ID",
     "token": "your bot token"
   }
   ```
1. Install dependencies
   ```sh
   npm ci
   ```
1. Register commands with Discord's API. This step requires Node.js on your
   system, but only needs to be done once, and can be done from any computer.
   ```sh
   npm run register
   ```

# Additional configuration

By default, the bot puts its config, database, and log in the project root.
If you're happy with this, great! You can move on to
[Running the bot](#running-the-bot).

If you'd like to change this behavior, here's how:

## `config.json` settings

You can tweak (almost) every setting for the bot from `config.json`. This is the
easiest way to change where the log and database files are stored.

```json
{
  "database_file": "path/to/database.sqlite",
  "log_file": "path/to/logfile.log",
}
```

## Starting arguments

You can tweak every setting for the bot with command-line arguments.
For example, to change where the config file is loaded, run the bot like this:

```sh
npm run start -- --config path/to/my_config.json
```

**Warning:** if you want to set the database location with `--dbfile`, you need
to use double-double quotes for the `knex` command:

```sh
npm run knex migrate:latest -- -- --dbfile path/to/file.sqlite
```

To see all available arguments, run:

```sh
npm run start -- --help
```

## Environment variables

You can use environment variables to change the bot's config. All environment
variables are prefixed with `ZERDA`. The following variables are supported:

- `ZERDA_APP`: The application ID.
- `ZERDA_CONFIG`: The config JSON file.
- `ZERDA_DATABASE`: The database file.
- `ZERDA_LOGFILE`: The log file.
- `ZERDA_TOKEN`: The bot's token.

## Which config takes priority?

Config is applied in this order (highest priority first):

1. Starting arguments (e.g. `--dbfile`)
1. `config.json` values
1. Environment variables
1. Default location (project root)

You can mix and match these (e.g. specifying database with `--dbfile` and token
with `ZERDA_TOKEN` environment variable).

# Running the bot

There are several options for running the bot.

## Running directly (Windows and Linux)

1. Set up the database
   ```bash
   npm run knex migrate:latest
   ```
2. Start the bot
   ```bash
   npm run start
   ```

## Running as a daemon (Linux)

The following will run the bot as a `systemd` service. If your distro uses
something other than `systemd`, you're on your own.

### As a service user:

1. Modify [`zerda.service`](../resources/zerda.service) as needed.
1. Install `zerda.service` to `/etc/systemd/system/`
2. Enable the service: `systemctl enable zerda.service`
3. Start the service: `systemctl start zerda.service`

### As your own user:

1. Modify [`zerda.service`](../resources/zerda.service) as needed.
1. Install `zerda.service` to `~/.config/systemd/user`
1. Enable lingering processes for your user: `loginctl enable-linger $USER`
1. Enable the service: `systemctl --user enable zerda.service`
1. Start the service: `systemctl --user start zerda.service`

## Running with Docker (Windows and Linux)

You will need both Docker and docker-compose installed. The following uses
`docker-compose` to build and start the bot in Docker.

```sh
# Start in foreground
npm run docker:start

# OR
# Start in background as daemon
npm run docker:daemon:start
```

When / If you want to stop a daemonized bot:

```bash
npm run docker:daemon:stop
```
