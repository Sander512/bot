// bot/commands/staffactivity.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}u ${m}m`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staffactivity')
    .setDescription('[Staff] Bekijk wie er nu in staffdienst is + de dienst-leaderboard'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const [{ staff: active }, { staff: leaderboard }] = await Promise.all([
        api.getActiveStaffDuty(),
        api.getStaffDutyLeaderboard(10),
      ]);

      const embed = embeds.info('🛡️ Staffdienst');

      if (active.length === 0) {
        embed.addFields({ name: 'Nu in dienst', value: 'Niemand is momenteel in staffdienst.' });
      } else {
        const lines = await Promise.all(
          active.map(async (s) => {
            const mention = s.discordId ? `<@${s.discordId}>` : s.robloxUsername || s.robloxId;
            const since = s.dutyStartedAt ? formatDuration(Math.floor((Date.now() - s.dutyStartedAt) / 1000)) : '?';
            return `${mention} — sinds ${since}`;
          })
        );
        embed.addFields({ name: `Nu in dienst (${active.length})`, value: lines.join('\n') });
      }

      if (leaderboard.length > 0) {
        const lines = leaderboard.map((s, i) => {
          const mention = s.discordId ? `<@${s.discordId}>` : s.robloxUsername || s.robloxId;
          return `**${i + 1}.** ${mention}${s.onDuty ? ' 🟢' : ''} — ${formatDuration(s.totalDutySeconds)}`;
        });
        embed.addFields({ name: 'Dienst-leaderboard (totaal)', value: lines.join('\n') });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
