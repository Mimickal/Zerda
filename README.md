# Zerda
Zerda is a Discord bot that assigns a temporary role to people playing
certain games so that they sort higher in the user list. This will allow people
to more easily find matches and join each others' matches from Discord.

## How to use
Required:
1. [Invite the bot to your server]() (link coming soon)
1. Give the bot the `Manage Roles` permission.
1. Add some games to track (See [Commands](#commands))

Optional:
- Change the color of the "Currently Playing" role
- Reorder the "Currently Playing" role (makes it sort above or below other
  roles).
- You could also disable `Display role members separately from online members`,
  but that sort of undermines the point of this bot.

### Warnings
- **The role must be named "Currently Playing" or the bot will not recognize it!**
(and will create another role).
- The bot's role needs to be sorted above the "Currently Playing" role, or it
will not be allowed to assign the role.

### Commands
This bot uses slash commands exclusively. You will also need to know your game's
(aka Application's) ID. See [Where can I find my Application ID](
https://support-dev.discord.com/hc/en-us/articles/360028717192-Where-can-I-find-my-Application-Team-Server-ID-)

- **Start tracking an application**
  - `/app add application-id: <Discord app ID here>`
- **Stop tracking an application**
  - `/app remove application-id: <Discord app ID here>`
- **List all of the applications being tracked in the server**
  - `/app list`

## How it works
When the bot joins your server, it will create a role called "Currently
Playing" that is configured to display users separately. Anybody playing a
supported game will be assigned this role. If they stop playing, go offline, or
change their status to "Do Not Disturb", the bot will remove the role.

### What if I want the bot to stop tracking my status?
The bot will not assign you the "Currently Playing" role if you do any of the
following:

- Disable "Display current activity as a status message" in your Discord settings.
- Change status to "Do Not Disturb"
- Change status to "Invisible" (or actually go offline)

### What if I want to remove the bot from my server?
Kicking the bot and deleting the "Now Playing" role will effectively clean up
all traces of the bot in your server.

### Information storage disclosure
This bot logs the following data:

- The name and ID of servers it is in
- The ID of applications tracked per server
- The name, nickname, and ID of server members who,
  - Start a tracked activity
  - Stop a tracked activity
  - Issue a command
- The command itself
- The content of Direct Messages (messages sent via DMs. No server messages are
  logged)

These logs are stored securely, privately, and used solely for troubleshooting.

#### Why log this stuff?
In the past, I've had other bots log nothing other than actual errors (See the
commit history of https://github.com/Mimickal/ReactionRoleBot). I found out the
hard way that this is not enough information to help people troubleshoot issues,
especially when the bot is in many servers, most of which are private.
Having this additional information allows me to ask someone "What's your server
ID?" instead of asking 20+ questions, or worse, needing to join their server and
dig through their settings.

#### Requesting your information (or deleting it)
Logs and database entries for users and servers can be made available (or
deleted) upon request. [Join the support server](https://discord.gg/7UBT8SK) to
file your request.

### Hosting your own instance
This bot is built on Discord.js 13.1.0, which requires Node.js 16.6.0 or newer.

## Fun facts
Zerda gets its name from "Vulpes zerda", the taxonomic name for fennec foxes,
because much like fennec foxes, this bot is tiny, fast, and makes a lot of noise.

