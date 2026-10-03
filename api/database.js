// api/database.js
//
// Uses @libsql/client, which speaks the same SQL dialect as SQLite but can
// connect to either:
//   1. Turso (a free, hosted SQLite-compatible database) — set
//      TURSO_DATABASE_URL + TURSO_AUTH_TOKEN. Data survives redeploys on
//      hosts like Render without needing a paid Persistent Disk, because
//      the database lives on Turso's servers, not on Render's filesystem.
//   2. A local file — used automatically when TURSO_DATABASE_URL is not
//      set, for local development. Same code, same queries, either way.

const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const url = process.env.TURSO_DATABASE_URL || `file:${process.env.DATABASE_PATH || './data/community.sqlite'}`;
const authToken = process.env.TURSO_AUTH_TOKEN; // not used/needed in local file mode

// In local file mode, make sure the containing directory exists —
// libSQL (unlike better-sqlite3) does not create it automatically.
if (url.startsWith('file:')) {
  const filePath = url.slice('file:'.length);
  const dir = path.dirname(filePath);
  if (dir && dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const db = createClient(authToken ? { url, authToken } : { url });

const SCHEMA = `
-- ---- Discord guilds the bot is in ----
-- Kept in sync by the bot itself (on ready + guildCreate/guildDelete) via
-- authenticated API calls. The dashboard's "kies een server" screen cross-
-- references this against the guilds the logged-in Discord user can
-- manage, so it only ever shows servers that are BOTH bot-joined AND
-- theirs to configure.
CREATE TABLE IF NOT EXISTS discord_guilds (
  guild_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  updated_at INTEGER NOT NULL
);

-- ---- Giveaways ----
-- Button-based giveaway (GiveawayBot-style 🎉 "Enter" button). Entries are
-- stored right here as a JSON array of Discord user IDs, toggled via
-- POST /giveaways/enter whenever someone clicks the button — that's what
-- powers the live "Entries: N" counter on the embed.
CREATE TABLE IF NOT EXISTS giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT UNIQUE NOT NULL,
  prize TEXT NOT NULL,
  description TEXT,
  winner_count INTEGER NOT NULL DEFAULT 1,
  host_id TEXT NOT NULL,
  required_role_id TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | ended | cancelled
  entries TEXT NOT NULL DEFAULT '[]', -- JSON array of Discord user IDs who entered
  winners TEXT, -- JSON array of Discord user IDs, set once ended
  ends_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_giveaways_status ON giveaways(status, ends_at);
CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id, status);

-- ---- Welcome messages ----
-- One row per guild: fully configurable via the dashboard. The bot reads
-- this on every guildMemberAdd event and posts the message (+ optional
-- embed, + optional auto-role) accordingly.
CREATE TABLE IF NOT EXISTS welcome_config (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  channel_id TEXT,
  content TEXT DEFAULT 'Welkom {user}! 🎉',
  embed_enabled INTEGER NOT NULL DEFAULT 1,
  embed_title TEXT DEFAULT 'Welkom in de community! 🌙',
  embed_description TEXT DEFAULT '{user} is zojuist lid geworden. We zijn nu met **{membercount}** leden!',
  embed_color TEXT NOT NULL DEFAULT '7c5cff',
  embed_image TEXT,
  embed_footer TEXT DEFAULT NULL,
  use_avatar_thumbnail INTEGER NOT NULL DEFAULT 1,
  auto_role_id TEXT,
  dm_enabled INTEGER NOT NULL DEFAULT 0,
  dm_message TEXT DEFAULT 'Welkom in de community, {username}! Fijn dat je er bent. 🌙',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

// Columns added after the initial release. CREATE TABLE IF NOT EXISTS does
// not retrofit existing tables, so on every boot we make sure these exist
// too — each ALTER is wrapped so an "already exists" error (fresh installs
// that already have the column via SCHEMA above) is silently ignored.
const MIGRATIONS = [
  // Giveaways: retrofit for databases created before the button/description/
  // entries system existed.
  `ALTER TABLE giveaways ADD COLUMN description TEXT`,
  `ALTER TABLE giveaways ADD COLUMN entries TEXT NOT NULL DEFAULT '[]'`,
  // Welcome messages: retrofit for databases created before this feature.
  `ALTER TABLE welcome_config ADD COLUMN dm_enabled INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE welcome_config ADD COLUMN dm_message TEXT DEFAULT 'Welkom in de community, {username}! Fijn dat je er bent. 🌙'`,
];

async function initDb() {
  await db.executeMultiple(SCHEMA);

  for (const sql of MIGRATIONS) {
    try {
      await db.execute({ sql, args: [] });
    } catch (err) {
      if (!/duplicate column/i.test(err.message)) throw err;
    }
  }
}

module.exports = { db, initDb };
