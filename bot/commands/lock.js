// bot/commands/lock.js
const { SlashCommandBuilder, MessageFlags, ChannelType } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('[Management] Sluit een kanaal: niemand kan er nog typen')
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
      await channel.permissionOverwrites.edit(
        interaction.guild.roles.everyone,
        { SendMessages: false, SendMessagesInThreads: false },
        { reason: `Lock door ${interaction.user.tag}` }
      );

      await interaction.editReply({ embeds: [embeds.success('Kanaal gesloten', `${channel} is gesloten. Gebruik \`/unlock\` om het te openen.`)] });

      await logger.auditLog(client, {
        action: 'LOCK',
        details: `<#${channel.id}> — door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
