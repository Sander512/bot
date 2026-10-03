// bot/commands/announce.js
const { SlashCommandBuilder, MessageFlags, ChannelType } = require('discord.js');
const config = require('../config');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('[Management] Plaats een aankondiging in de community')
    .setDMPermission(false)
    .addStringOption((opt) =>
      opt.setName('bericht').setDescription('Het bericht').setRequired(true).setMaxLength(1500)
    )
    .addChannelOption((opt) =>
      opt
        .setName('kanaal')
        .setDescription('Waar de aankondiging geplaatst wordt (standaard: 📢・announcements)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const message = interaction.options.getString('bericht', true);
    let channel = interaction.options.getChannel('kanaal');

    try {
      if (!channel) {
        const all = await interaction.guild.channels.fetch();
        channel = all.find((c) => c && c.isTextBased() && c.name.includes('announcements')) || null;
      }

      if (!channel) {
        await interaction.editReply({
          embeds: [embeds.warning('Geen kanaal gevonden', 'Kies zelf een kanaal met de optie `kanaal`.')],
        });
        return;
      }

      await channel.send({
        embeds: [embeds.custom({ title: '📢 Aankondiging', description: message, color: config.colors.primary })],
      });

      await interaction.editReply({
        embeds: [embeds.success('Aankondiging geplaatst', `Geplaatst in ${channel}.`)],
      });

      await logger.auditLog(client, {
        action: 'ANNOUNCE',
        discordId: interaction.user.id,
        details: `"${message}" in #${channel.name}`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
