// bot/commands/avatar.js
const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Bekijk iemands profielfoto groot')
    .addUserOption((opt) =>
      opt.setName('gebruiker').setDescription('Van wie? (standaard: jezelf)').setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('gebruiker') || interaction.user;
    const url = target.displayAvatarURL({ size: 1024 });

    await interaction.reply({
      embeds: [
        embeds.custom({
          title: `🖼️ Avatar van ${target.displayName ?? target.username}`,
          description: `[Open in volledige grootte](${url})`,
          image: url,
        }),
      ],
    });
  },
};
