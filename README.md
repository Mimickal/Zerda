# Zerda
Zerda is a Discord bot that assigns a temporary role to people playing
certain games so that they sort higher in the user list. This will allow people
to more easily find matches and join each others' matches from Discord.

## How to use
Required:
1. [Invite the bot to your server]() (link coming soon)
1. Give the bot the `Manage Roles` permission.

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

## How it works
When the bot joins your server, it will create a role called "Currently
Playing" that is configured to display users separately. Anybody playing a
supported game will be assigned this role. If they stop playing, go offline, or
change their status to "Do Not Disturb", the bot will remove the role.

### Supported Games (Application ID)
- Halo: Custom Edition (496775885249314885)

This bot is currently only intended to work alongside
[Vulpes](https://github.com/Sigmmma/Vulpes), the Halo: CE engine extension mod.
If it proves to be a popular enough concept, I may add the ability to configure
more hoisted games.

## Fun facts
Zerda gets its name from "Vulpes zerda", the taxonomic name for fennec foxes,
because much like fennec foxes, this bot is tiny, fast, and makes a lot of noise.

