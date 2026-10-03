// bot/commands/rps.js
const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../utils/embeds');

const CHOICES = {
  steen: { emoji: '🪨', beats: 'schaar' },
  papier: { emoji: '📄', beats: 'steen' },
  schaar: { emoji: '✂️', beats: 'papier' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Steen, papier, schaar tegen de bot')
    .addStringOption((opt) =>
      opt
        .setName('keuze')
        .setDescription('Jouw keuze')
        .setRequired(true)
        .addChoices(
          { name: '🪨 Steen', value: 'steen' },
          { name: '📄 Papier', value: 'papier' },
          { name: '✂️ Schaar', value: 'schaar' }
        )
    ),

  async execute(interaction) {
    const mine = interaction.options.getString('keuze', true);
    const keys = Object.keys(CHOICES);
    const theirs = keys[Math.floor(Math.random() * keys.length)];

    let result;
    let build = embeds.info;
    if (mine === theirs) {
      result = 'Gelijkspel!';
    } else if (CHOICES[mine].beats === theirs) {
      result = 'Jij wint! 🎉';
      build = embeds.success;
    } else {
      result = 'Ik win! 😎';
      build = embeds.warning;
    }

    await interaction.reply({
      embeds: [
        build(
          'Steen, papier, schaar',
          `Jij: ${CHOICES[mine].emoji} **${mine}**\nIk: ${CHOICES[theirs].emoji} **${theirs}**\n\n**${result}**`
        ),
      ],
    });
  },
};
