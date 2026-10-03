// bot/utils/permissions.js
// Centralized permission checking for all slash commands.
//
// Rules:
//  - Administrator (Discord permission) always has access to everything.
//  - Management role has access to everything in MANAGEMENT_COMMANDS.
//  - The optional staff role only has access to commands listed in STAFF_COMMANDS.

const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');

// Commands management is allowed to run.
// Management = Discord Administrators (👑・Owner) + the optional MANAGEMENT_ROLE_ID.
const MANAGEMENT_COMMANDS = new Set([
  'ban',
  'unban',
  'kick',
  'announce',
  'clear',
  'timeout',
  'untimeout',
  'slowmode',
  'say',
  'lock',
  'unlock',
  'giveaway-start',
  'giveaway-end',
  'giveaway-reroll',
  'welcome-test',
]);

// Commands the optional STAFF_ROLE_ID is explicitly allowed to run.
// Edit this list to grant that role access to specific commands.
const STAFF_COMMANDS = new Set([
  'giveaway-list',
]);

// Commands anyone in the server may run.
const PUBLIC_COMMANDS = new Set([
  'userinfo',
  'ping',
  'avatar',
  'serverinfo',
  'poll',
  'choose',
  'rps',
  'rate',
  'hug',
  '8ball',
  'coinflip',
  'roll',
]);

function isAdministrator(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

function hasRole(interaction, roleId) {
  if (!roleId) return false;
  return interaction.member?.roles?.cache?.has(roleId) ?? false;
}

function isManagement(interaction) {
  return isAdministrator(interaction) || hasRole(interaction, config.roles.managementRoleId);
}

function isStaff(interaction) {
  return isManagement(interaction) || hasRole(interaction, config.roles.staffRoleId);
}

/**
 * Determine whether the interaction's user may run the given command name.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} commandName
 * @returns {boolean}
 */
function canRunCommand(interaction, commandName) {
  if (isAdministrator(interaction)) return true;

  if (PUBLIC_COMMANDS.has(commandName)) return true;

  if (MANAGEMENT_COMMANDS.has(commandName)) {
    return isManagement(interaction);
  }

  if (STAFF_COMMANDS.has(commandName)) {
    return isStaff(interaction);
  }

  // Unknown command — default deny.
  return false;
}

module.exports = {
  canRunCommand,
  isAdministrator,
  isManagement,
  isStaff,
  MANAGEMENT_COMMANDS,
  STAFF_COMMANDS,
  PUBLIC_COMMANDS,
};
