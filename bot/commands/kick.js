// bot/commands/kick.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('[Management] Kick iemand uit de server')
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName('gebruiker').setDescription('De gebruiker die je wilt kicken').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reden').setDescription('Reden voor de kick').setRequired(false).setMaxLength(500)
    ),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('gebruiker', true);
    const reason = interaction.options.getString('reden') || 'Geen reden opgegeven';

    if (target.id === interaction.user.id) {
      await interaction.editReply({ embeds: [embeds.error('Dat kan niet', 'Je kunt jezelf niet kicken.')] });
      return;
    }
    if (target.id === client.user.id) {
      await interaction.editReply({ embeds: [embeds.error('Dat kan niet', 'Je kunt de bot niet kicken.')] });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.editReply({ embeds: [embeds.error('Niet gevonden', `<@${target.id}> zit niet in de server.`)] });
        return;
      }
      if (!member.kickable) {
        await interaction.editReply({
          embeds: [embeds.error('Niet mogelijk', 'Ik kan deze gebruiker niet kicken (rol staat hoger dan die van mij of is de eigenaar).')],
        });
        return;
      }

      await member.kick(`${reason} — door ${interaction.user.tag}`);

      await interaction.editReply({
        embeds: [embeds.success('Gebruiker gekickt', `<@${target.id}> is uit de server gezet.\nReden: ${reason}`)],
      });

      await logger.auditLog(client, {
        action: 'KICK',
        discordId: target.id,
        details: `Reden: ${reason} — door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
