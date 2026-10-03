# 🌙 Community Bot

Een rustige, moderne Discord-bot met dashboard voor je chille community server. Past bij de server die `discordbuilder.js` opbouwt (rollen zoals 👑・Owner, 🎙️・Voice, kanalen zoals 📢・announcements en 👋・welcome).

Geen Roblox, geen verificatie, geen tickets: alleen wat een gezellige community nodig heeft.

## Commands

**Voor iedereen**

| Command | Wat |
|---|---|
| `/userinfo` | Info over een lid (account gemaakt, lid sinds, rollen) |
| `/serverinfo` | Leden, kanalen, rollen, boosts en meer |
| `/avatar` | Profielfoto groot bekijken |
| `/ping` | Check of de bot wakker is |
| `/poll` | Poll met 2 tot 5 opties (stemmen via reacties) |
| `/choose` | Laat de bot kiezen tussen opties |
| `/rps` | Steen, papier, schaar tegen de bot |
| `/rate` | Geef iets een cijfer (zelfde input = zelfde cijfer) |
| `/hug` | Geef iemand een knuffel |
| `/8ball` `/coinflip` `/roll` | Klassieke fun-commands |

**Alleen Management** (Administrators / 👑・Owner, of de rol uit `MANAGEMENT_ROLE_ID`)

| Command | Wat |
|---|---|
| `/ban` `/unban` `/kick` | Moderatie met reden |
| `/timeout` `/untimeout` | Iemand tijdelijk laten afkoelen (1 min tot 28 dagen) |
| `/clear` | 1-100 berichten verwijderen, eventueel van één gebruiker |
| `/slowmode` | Slowmode instellen voor een kanaal |
| `/lock` `/unlock` | Een kanaal sluiten of weer openen |
| `/say` | De bot een bericht laten sturen (zonder @everyone-pings) |
| `/announce` | Aankondiging in 📢・announcements (of een kanaal naar keuze) |
| `/giveaway-start` `-end` `-reroll` | Giveaways met 🎉-knop |
| `/welcome-test` | Het welkomstbericht testen |

`/giveaway-list` mag ook de rol uit `STAFF_ROLE_ID` (optioneel).

**Dashboard** (`/dashboard`): inloggen met Discord, daarna het welkomstbericht instellen (kanaal, tekst, embed, auto-rol zoals 👤・Member, DM) en giveaways bekijken. Placeholders: `{user}`, `{username}`, `{server}`, `{membercount}`.

## Rechten

- **Administrators** (je 👑・Owner rol) mogen alles.
- `MANAGEMENT_ROLE_ID` (optioneel): extra rol voor de management-commands.
- `STAFF_ROLE_ID` (optioneel): rol voor `/giveaway-list`.
- Staat niets ingesteld, dan kunnen alleen Administrators de management-commands gebruiken.
- Een command dat niet in `bot/utils/permissions.js` staat, wordt standaard geweigerd. Voeg je zelf een command toe, zet hem dan in de juiste lijst.

## Installeren

1. `npm install`
2. Kopieer `.env.example` naar `.env` en vul het in.
3. `npm run start:all` start API, dashboard en bot in één keer. Slash commands worden bij elke start automatisch geregistreerd.

### Discord Developer Portal

- Maak een applicatie + bot en kopieer de **token**, **Client ID** en **Client Secret**.
- Bot > Privileged Gateway Intents: zet **Server Members Intent** aan (nodig voor welkomstberichten).
- OAuth2 > Redirects: voeg `<PUBLIC_URL>/auth/discord/callback` toe.
- Nodig de bot uit met de scopes `bot` en `applications.commands`. Simpelste is Administrator. Anders heb je nodig: Ban Members, Kick Members, Moderate Members, Manage Messages, Manage Channels, Manage Roles, Add Reactions, Send Messages en Embed Links.
- De bot-rol moet in de rollenlijst **boven** de rollen staan die hij moet beheren (bv. 👤・Member voor de auto-rol, en iedereen die je wilt kunnen timeouten).

### .env

| Variabele | Verplicht | Uitleg |
|---|---|---|
| `COMMUNITY_NAME` | nee | Naam in embeds en bot-status (standaard "Chill Community") |
| `DISCORD_TOKEN` `DISCORD_CLIENT_ID` `DISCORD_GUILD_ID` | ja | Bot-gegevens en je server-ID |
| `DISCORD_CLIENT_SECRET` | ja | Voor inloggen op het dashboard |
| `API_KEY` | ja | Eigen geheime string; bot en API gebruiken die samen |
| `SESSION_SECRET` | ja | Lange random string voor de dashboard-login |
| `PUBLIC_URL` | ja | Waar de app bereikbaar is (lokaal `http://localhost:3000`) |
| `TURSO_DATABASE_URL` `TURSO_AUTH_TOKEN` | nee | Gehoste database; leeg = lokaal bestand `./data/community.sqlite` |
| `MANAGEMENT_ROLE_ID` `STAFF_ROLE_ID` | nee | Zie "Rechten" |
| `AUDIT_LOG_CHANNEL_ID` | nee | Kanaal voor logs van moderatie-acties |

## Mapstructuur

```
bot/       Discord-bot (commands, handlers, utils)
api/       Express API + database (giveaways, welcome, dashboard-login)
public/    Dashboard (HTML/CSS/JS)
start.js   Start API + bot samen
```

## Wat is verwijderd

- Alles van Roblox: de Lua-scripts, game-servers, verificatie en de game-commands (geld, jobs, items, ...)
- Het ticketsysteem: alle `/ticket-*` commands, de API-routes, database-tabellen en de dashboard-tabs
