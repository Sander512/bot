// bot/commands/choose.js
const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('choose')
    .setDescription('Laat de bot kiezen tussen opties')
    .addStringOption((opt) =>
      opt
        .setName('opties')
        .setDescription('Opties gescheiden door een komma, bv. pizza, friet, sushi')
        .setRequired(true)
        .setMaxLength(500)
    ),

  async execute(interaction) {
    const options = interaction.options
      .getString('opties', true)
      .split(/[,|]/)
      .map((o) => o.trim())
      .filter(Boolean);

    if (options.length < 2) {
      await interaction.reply({
        embeds: [embeds.warning('Te weinig opties', 'Geef minimaal 2 opties, gescheiden door een komma.')],
        flags: 64,
      });
      return;
    }

    const pick = options[Math.floor(Math.random() * options.length)];
    await interaction.reply({
      embeds: [embeds.info('🤔 Mijn keuze', `Uit **${options.length}** opties kies ik: **${pick}**`)],
      allowedMentions: { parse: [] },
    });
  },
};
