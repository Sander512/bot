// bot/commands/unlock.js
const { SlashCommandBuilder, MessageFlags, ChannelType } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('[Management] Open een gesloten kanaal weer')
    .setDMPermission(false)
    .addChannelOption((opt) =>
      opt
        .setName('kanaal')
        .setDescription('Standaard: dit kanaal')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('kanaal') || interaction.channel;

    try {
      // null = terug naar de standaard (overerven), niet "forceer toestaan"
      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { SendMessages: null, SendMessagesInThreads: null },
        { reason: `Unlock door ${interaction.user.tag}` }
      );

      await interaction.editReply({ embeds: [embeds.success('Kanaal geopend', `${channel} is weer open.`)] });

      await logger.auditLog(client, {
        action: 'UNLOCK',
        details: `<#${channel.id}> — door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
