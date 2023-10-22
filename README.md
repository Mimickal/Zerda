# Zerda

<a href="LICENSE.md"><img align="right" alt="AGPL-3.0 Logo"
src="https://www.gnu.org/graphics/agplv3-155x51.png">
</a>

Zerda is a Discord bot that assigns a temporary role to people playing
games so that they sort higher in the user list. You can configure which games
Zerda assigns the playing role for. This will allow people to more easily find
matches and join each others' matches from Discord.


### [Invite Zerda to your server](https://discord.com/api/oauth2/authorize?client_id=884160015542419457&permissions=268437504&scope=bot%20applications.commands)

### Need help? [Join the support server here](https://discord.gg/7UBT8SK)

# How it works

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

# How to use

### Required:

1. [Invite the bot to your server](https://discord.com/api/oauth2/authorize?client_id=884160015542419457&permissions=268437504&scope=bot%20applications.commands).
1. Make sure the bot has `Manage Roles` and `Send Messages` permissions.
1. Make sure the bot's role is sorted above the "Currently Playing" role.
1. Add some games to track (See [Commands](#commands))

### Optional:

- Change the color of the "Currently Playing" role.
- Reorder the "Currently Playing" role to determine where members are shown in
  the list. Remember to keep Zerda's bot role ordered above "Currently Playing"!
- You could also disable `Display role members separately from online members`,
  but that sort of undermines the point of this bot.

### Warnings

- **The role must be named "Currently Playing" or the bot will not recognize it!**
(and will create another role).
- The bot's role needs to be sorted above the "Currently Playing" role, or it
will not be allowed to assign the role.
- Zerda makes a lot of noise in your server's audit log. Every time it adds or
  removes the a role, it makes a new entry in the log. You can filter events
  by user and by action type, so this isn't a *huge* problem, but it's worth
  calling out up front.

## Commands

This bot uses slash commands exclusively. You need to use `/app get` to get a
game's application ID from a user's current activities, because Discord does not
have a public list of this info, for some reason.

- **Get a user's activities (including applications)**
  - `/app get [user: <User ID here>]`
  - To get the ID for the game you want to track, use this command on a user
    playing that game (or yourself).
- **Start tracking an application** (Requires Admin)
  - `/app add application-id: <Discord app ID here>`
- **Stop tracking an application** (Requires Admin)
  - `/app remove application-id: <Discord app ID here>`
- **List all of the applications being tracked in the server**
  - `/app list`

# Fun facts

Zerda gets its name from "Vulpes Zerda", the taxonomic name for fennec foxes,
because much like fennec foxes, this bot is tiny, fast, and makes a lot of noise.

# License

Copyright 2020 [Mimickal](https://github.com/Mimickal)<br/>
This code is licensed under the
[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0-standalone.html) license.<br/>
Basically, any modifications to this code must be made open source.
