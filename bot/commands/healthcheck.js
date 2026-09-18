// bot/commands/healthcheck.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('healthcheck')
    .setDescription('[Staff] Bekijk de status van de API, database en command-wachtrij'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = embeds.info('🩺 Forever RP Healthcheck');
    let anyFailure = false;

    // API + database — if this call succeeds at all, the API is up and could
    // read the database, so both are implicitly healthy.
    try {
      const { servers } = await api.getOnlineServers();
      const totalPlayers = servers.reduce((sum, s) => sum + s.players, 0);
      embed.addFields({
        name: 'API + Database',
        value: '✅ Bereikbaar',
        inline: true,
      });
      embed.addFields({
        name: 'Roblox servers',
        value: servers.length > 0 ? `🟢 ${servers.length} online (${totalPlayers} spelers)` : '🔴 Geen servers hebben recent een heartbeat gestuurd',
        inline: true,
      });
    } catch (err) {
      anyFailure = true;
      embed.addFields({ name: 'API + Database', value: `❌ ${err.message}` });
    }

    try {
      const { lastHour } = await api.getQueueStatus();
      const backlog = lastHour.pending + lastHour.processing;
      embed.addFields({
        name: 'Command-wachtrij (laatste uur)',
        value: `${backlog > 20 ? '⚠️' : '✅'} ${lastHour.completed} voltooid, ${lastHour.failed} mislukt, ${lastHour.expired} verlopen, ${backlog} in behandeling`,
      });
    } catch (err) {
      anyFailure = true;
      embed.addFields({ name: 'Command-wachtrij', value: `❌ ${err.message}` });
    }

    if (anyFailure) {
      embed.setColor(0xef4444).setTitle('🩺 Forever RP Healthcheck — problemen gevonden');
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
