// bot/commands/userinfo.js
const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Bekijk informatie over een lid')
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName('gebruiker').setDescription('Het lid (standaard: jezelf)').setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('gebruiker') || interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const created = Math.floor(target.createdTimestamp / 1000);
    const fields = [
      { name: 'Gebruiker', value: `<@${target.id}>`, inline: true },
      { name: 'ID', value: target.id, inline: true },
      { name: 'Account gemaakt', value: `<t:${created}:D> (<t:${created}:R>)` },
    ];

    if (member) {
      const joined = Math.floor(member.joinedTimestamp / 1000);
      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`);

      fields.push(
        { name: 'Lid sinds', value: `<t:${joined}:D> (<t:${joined}:R>)` },
        { name: `Rollen (${roles.length})`, value: roles.length ? roles.slice(0, 20).join(' ') : 'Geen rollen' }
      );
    }

    const embed = embeds
      .custom({
        title: target.displayName ?? target.username,
        thumbnail: target.displayAvatarURL({ size: 256 }),
        fields,
      });

    await interaction.reply({ embeds: [embed] });
  },
};
