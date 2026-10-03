// bot/commands/hug.js
const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hug')
    .setDescription('Geef iemand een knuffel')
    .setDMPermission(false)
    .addUserOption((opt) => opt.setName('gebruiker').setDescription('Wie krijgt een knuffel?').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('gebruiker', true);

    const text =
      target.id === interaction.user.id
        ? `<@${interaction.user.id}> knuffelt zichzelf. Zelfliefde is ook liefde 💜`
        : `<@${interaction.user.id}> geeft <@${target.id}> een dikke knuffel 🤗`;

    await interaction.reply({
      embeds: [embeds.custom({ description: text })],
      allowedMentions: { users: target.id === interaction.user.id ? [] : [target.id] },
    });
  },
};
