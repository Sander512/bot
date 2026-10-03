// bot/commands/rate.js
// Geeft een "cijfer" aan alles. Zelfde input = zelfde cijfer (hash), dus
// niemand kan door opnieuw te proberen een hoger cijfer krijgen.
const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../utils/embeds');

function hash(text) {
  let h = 0;
  for (const ch of text.toLowerCase().trim()) {
    h = (h * 31 + ch.codePointAt(0)) >>> 0;
  }
  return h;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rate')
    .setDescription('Laat de bot iets een cijfer geven')
    .addStringOption((opt) =>
      opt.setName('ding').setDescription('Wat moet beoordeeld worden?').setRequired(true).setMaxLength(100)
    ),

  async execute(interaction) {
    const thing = interaction.options.getString('ding', true);
    const score = hash(thing) % 11; // 0 t/m 10
    const bar = '🟪'.repeat(score) + '⬛'.repeat(10 - score);

    await interaction.reply({
      embeds: [embeds.info('⭐ Beoordeling', `**${thing}**\n${bar}\nCijfer: **${score}/10**`)],
      allowedMentions: { parse: [] },
    });
  },
};
