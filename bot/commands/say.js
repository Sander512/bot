// bot/commands/say.js
const { SlashCommandBuilder, MessageFlags, ChannelType } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('[Management] Laat de bot een bericht sturen')
    .setDMPermission(false)
    .addStringOption((opt) => opt.setName('bericht').setDescription('Wat moet de bot zeggen?').setRequired(true).setMaxLength(1500))
    .addChannelOption((opt) =>
      opt
        .setName('kanaal')
        .setDescription('Standaard: dit kanaal')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const message = interaction.options.getString('bericht', true);
    const channel = interaction.options.getChannel('kanaal') || interaction.channel;

    try {
      // Geen @everyone/@here/rol-pings via dit command.
      await channel.send({ content: message, allowedMentions: { parse: ['users'] } });

      await interaction.editReply({ embeds: [embeds.success('Verstuurd', `Bericht geplaatst in ${channel}.`)] });

      await logger.auditLog(client, {
        action: 'SAY',
        details: `In <#${channel.id}> — door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
