// bot/commands/leaderboard.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');

const SORT_LABELS = {
  cash: 'Contant',
  bank: 'Bank',
  xp: 'XP',
  playtime: 'Playtime',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Bekijk de top spelers')
    .addStringOption((opt) =>
      opt
        .setName('sortering')
        .setDescription('Waarop sorteren (standaard: Contant)')
        .addChoices(
          { name: 'Contant', value: 'cash' },
          { name: 'Bank', value: 'bank' },
          { name: 'XP', value: 'xp' },
          { name: 'Playtime', value: 'playtime' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const sort = interaction.options.getString('sortering') || 'cash';

    try {
      const { players } = await api.getStatsLeaderboard(sort, 10);

      if (!players.length) {
        await interaction.editReply({
          embeds: [embeds.info('Nog geen data', 'Er is nog geen stats-data verzameld. Spelers moeten eerst online zijn geweest.')],
        });
        return;
      }

      const valueKey = sort === 'playtime' ? 'playtimeMinutes' : sort;
      const suffix = sort === 'playtime' ? ' min' : '';

      const lines = players.map(
        (p, i) => `**${i + 1}.** ${p.robloxUsername || p.robloxId} — ${p[valueKey]}${suffix}`
      );

      await interaction.editReply({
        embeds: [embeds.info(`🏆 Leaderboard — ${SORT_LABELS[sort]}`, lines.join('\n'))],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
