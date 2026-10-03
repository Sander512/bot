// bot/commands/serverinfo.js
const { SlashCommandBuilder, ChannelType } = require('discord.js');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Bekijk info over de server')
    .setDMPermission(false),

  async execute(interaction) {
    const guild = interaction.guild;
    const created = Math.floor(guild.createdTimestamp / 1000);
    const channels = guild.channels.cache;

    const text = channels.filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).size;
    const voice = channels.filter((c) => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size;

    await interaction.reply({
      embeds: [
        embeds.custom({
          title: `🌙 ${guild.name}`,
          thumbnail: guild.iconURL({ size: 256 }) || undefined,
          fields: [
            { name: '👑 Eigenaar', value: `<@${guild.ownerId}>`, inline: true },
            { name: '👥 Leden', value: String(guild.memberCount), inline: true },
            { name: '🎭 Rollen', value: String(guild.roles.cache.size - 1), inline: true },
            { name: '💬 Tekstkanalen', value: String(text), inline: true },
            { name: '🔊 Voicekanalen', value: String(voice), inline: true },
            { name: '🚀 Boosts', value: `${guild.premiumSubscriptionCount ?? 0} (level ${guild.premiumTier})`, inline: true },
            { name: '📅 Gemaakt', value: `<t:${created}:D> (<t:${created}:R>)` },
          ],
        }),
      ],
    });
  },
};
