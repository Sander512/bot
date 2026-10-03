// bot/commands/slowmode.js
const { SlashCommandBuilder, MessageFlags, ChannelType } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('[Management] Stel slowmode in voor een kanaal')
    .setDMPermission(false)
    .addIntegerOption((opt) =>
      opt.setName('seconden').setDescription('Seconden tussen berichten (0 = uit, max 21600)').setRequired(true).setMinValue(0).setMaxValue(21600)
    )
    .addChannelOption((opt) =>
      opt
        .setName('kanaal')
        .setDescription('Standaard: dit kanaal')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const seconds = interaction.options.getInteger('seconden', true);
    const channel = interaction.options.getChannel('kanaal') || interaction.channel;

    try {
      await channel.setRateLimitPerUser(seconds, `Slowmode door ${interaction.user.tag}`);

      await interaction.editReply({
        embeds: [
          embeds.success(
            seconds === 0 ? 'Slowmode uit' : 'Slowmode ingesteld',
            seconds === 0 ? `Slowmode in ${channel} is uitgezet.` : `In ${channel} mag je nu om de **${seconds} sec** een bericht sturen.`
          ),
        ],
      });

      await logger.auditLog(client, {
        action: 'SLOWMODE',
        details: `${seconds}s in <#${channel.id}> — door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
