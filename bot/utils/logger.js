// bot/utils/logger.js
// Simple structured logger + Discord audit-log channel poster.

const config = require('../config');
const embeds = require('./embeds');

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function info(msg, ...args) {
  console.log(`[${timestamp()}] [INFO] ${msg}`, ...args);
}

function warn(msg, ...args) {
  console.warn(`[${timestamp()}] [WARN] ${msg}`, ...args);
}

function error(msg, ...args) {
  console.error(`[${timestamp()}] [ERROR] ${msg}`, ...args);
}

// Which category each action belongs to, so existing call sites
// (logger.auditLog(client, { action: 'SET_JOB', ... })) automatically route
// to the right channel without needing to be touched. Unlisted actions fall
// back to the general AUDIT_LOG_CHANNEL_ID.
const CATEGORY_BY_ACTION = {
  GIVE_MONEY: 'economy',
  REMOVE_MONEY: 'economy',
  SET_MONEY: 'economy',
  GIVE_COINS: 'economy',
  GIVE_PACK: 'economy',
  GIVE_ITEM: 'economy',
  CLEAR_INVENTORY: 'economy',
  GIVE_VEHICLE: 'economy',
  REMOVE_VEHICLE: 'economy',
  SET_XP: 'economy',
  BAN: 'moderation',
  UNBAN: 'moderation',
  KICK: 'moderation',
  WARN: 'moderation',
  WARN_REVOKE: 'moderation',
  NOTE_ADD: 'moderation',
  UNVERIFY: 'moderation',
  JUMPSCARE: 'moderation',
  REVIVE: 'moderation',
  SHUTDOWN: 'moderation',
  SET_RANK: 'moderation',
  SET_JOB: 'moderation',
  WHITELIST_ADD: 'moderation',
  WHITELIST_REMOVE: 'moderation',
  STAFF_DUTY_ON: 'staff',
  STAFF_DUTY_OFF: 'staff',
};

function channelForCategory(category) {
  return (category && config.roles.auditLogChannels[category]) || config.roles.auditLogChannelId;
}

/**
 * Send an audit embed to the configured audit log channel, if set.
 * Routed by category (see CATEGORY_BY_ACTION) to AUDIT_LOG_CHANNEL_ECONOMY /
 * _MODERATION / _STAFF when those are configured, falling back to the
 * general AUDIT_LOG_CHANNEL_ID otherwise.
 * @param {import('discord.js').Client} client
 * @param {{action:string, discordId?:string, robloxId?:string|number, details?:string}} entry
 */
async function auditLog(client, entry) {
  info(`AUDIT: ${entry.action} | discord=${entry.discordId || 'N/A'} roblox=${entry.robloxId || 'N/A'} | ${entry.details || ''}`);

  const channelId = channelForCategory(CATEGORY_BY_ACTION[entry.action]);
  if (!channelId) return;

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embeds.audit(entry)] });
    }
  } catch (err) {
    warn(`Kon geen audit log versturen naar channel: ${err.message}`);
  }
}

module.exports = { info, warn, error, auditLog };
