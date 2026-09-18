// bot/commands/warnings.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('[Staff] Bekijk de waarschuwingen van een speler')
    .addUserOption((opt) => opt.setName('discord').setDescription('De Discord gebruiker').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('discord', true);

    try {
      const { total, activeCount, warnings } = await api.getWarnings(target.id);

      if (total === 0) {
        await interaction.editReply({
          embeds: [embeds.info('Geen waarschuwingen', `<@${target.id}> heeft geen waarschuwingen.`)],
        });
        return;
      }

      const lines = warnings
        .slice(0, 10)
        .map(
          (w) =>
            `${w.active ? '⚠️' : '~~⚠️~~'} \`#${w.id}\` ${w.reason} — <@${w.staffId}> (${new Date(w.createdAt).toLocaleDateString('nl-NL')})`
        );

      await interaction.editReply({
        embeds: [
          embeds.info(
            `Waarschuwingen — ${activeCount} actief / ${total} totaal`,
            lines.join('\n') + (total > 10 ? `\n...en ${total - 10} meer` : '')
          ),
        ],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
