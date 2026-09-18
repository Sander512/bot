// bot/commands/setxp.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('[Management] Stel de XP van een speler in')
    .addUserOption((opt) =>
      opt.setName('discord').setDescription('De Discord gebruiker').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('aantal').setDescription('Nieuwe XP-waarde').setRequired(true).setMinValue(0)
    ),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('discord', true);
    const amount = interaction.options.getInteger('aantal', true);

    if (amount > config.limits.maxXpAmount) {
      await interaction.editReply({
        embeds: [embeds.error('Waarde te hoog', `Maximaal ${config.limits.maxXpAmount} XP.`)],
      });
      return;
    }

    try {
      const verification = await api.getVerificationByDiscordId(target.id);
      if (!verification?.verified) {
        await interaction.editReply({
          embeds: [embeds.error('Speler niet geverifieerd', `<@${target.id}> heeft geen gekoppeld Roblox account.`)],
        });
        return;
      }

      const command = await api.createCommand('set_xp', verification.robloxId, { amount }, interaction.user.id);

      await interaction.editReply({
        embeds: [
          embeds.success(
            'XP ingesteld',
            `<@${target.id}> (${verification.robloxUsername}) heeft nu **${amount} XP**.\nCommand ID: \`${command.id}\``
          ),
        ],
      });

      await logger.auditLog(client, {
        action: 'SET_XP',
        discordId: target.id,
        robloxId: verification.robloxId,
        details: `XP = ${amount} door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
