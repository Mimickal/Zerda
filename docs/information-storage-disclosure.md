# Information storage disclosure

## Database

Zerda stores the following in its database:

- The IDs of servers it is currently in.
- The IDs of applications it is currently tracking, per server.

This is the bare minimum information required for the bot to function.
When you kick Zerda from your server, it completely wipes every database entry
associated with your server.

## Logging

Zerda logs the following data:

- The ID of servers it joins.
- The ID of applications tracked, per server.
- The ID of server members who:
  - Start a tracked activity.
  - Stop a tracked activity.
  - Issue a command.
- The content of commands issued.
- Messages Zerda sends in response to commands.

These logs are stored securely, privately, and used solely for troubleshooting.
Unlike the database, when you kick Zerda from your server, log messages are
**not** deleted. If you would like to have your information scrubbed from the
logs, see below.

### Why log this stuff?

In the past, I've had other bots log nothing other than actual errors (See the
commit history of https://github.com/Mimickal/ReactionRoleBot). I found out the
hard way that this is not enough information to help people troubleshoot issues,
especially when the bot is in many servers, most of which are private.

Having this additional information allows me to ask someone "What's your server
ID?" instead of asking 20+ questions, or worse, needing to join their server and
dig through their settings.

## Requesting your information (or deleting it)

Logs and database entries for users and servers can be made available (or
deleted) upon request. [Join the support server](https://discord.gg/7UBT8SK) to
file your request.
