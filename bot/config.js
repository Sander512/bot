// bot/config.js
// Central configuration loaded from environment variables.
// Never hardcode secrets here — everything comes from .env

require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    console.warn(`[CONFIG WARNING] Missing environment variable: ${name}`);
  }
  return value;
}

const communityName = process.env.COMMUNITY_NAME || 'Chill Community';

const config = {
  branding: {
    name: communityName,
    footer: `🌙 ${communityName}`,
  },

  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    guildId: required('DISCORD_GUILD_ID'),
  },

  api: {
    // When bot + API run in the same process (start.js, e.g. on Render),
    // the API always binds to process.env.PORT (or API_PORT as fallback).
    // Default to that same port automatically so the bot never has to
    // guess/hardcode a port that doesn't match what the API actually bound to.
    // Set API_BASE_URL explicitly only if the API runs as a SEPARATE service.
    baseUrl:
      process.env.API_BASE_URL ||
      `http://localhost:${process.env.PORT || process.env.API_PORT || 3000}`,
    key: required('API_KEY'),
    port: parseInt(process.env.API_PORT, 10) || 3000,
  },

  database: {
    path: process.env.DATABASE_PATH || './data/community.sqlite',
  },

  // Optional. Leave empty and only Discord Administrators (the 👑・Owner
  // role) can use the management commands.
  roles: {
    staffRoleId: process.env.STAFF_ROLE_ID || null,
    managementRoleId: process.env.MANAGEMENT_ROLE_ID || null,
    auditLogChannelId: process.env.AUDIT_LOG_CHANNEL_ID || null,
  },

  // Dark, modern palette
  colors: {
    primary: 0x7c5cff, // Purple
    success: 0x2ecc71, // Green
    error: 0xed4245,
    warning: 0xf1c40f,
    info: 0x5865f2, // Blurple
  },
};

module.exports = config;
