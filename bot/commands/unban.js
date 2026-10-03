// bot/commands/unban.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('[Management] Unban iemand van de server')
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName('gebruiker').setDescription('De gebruiker die je wilt unbannen').setRequired(true)
    ),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('gebruiker', true);

    try {
      const ban = await interaction.guild.bans.fetch(target.id).catch(() => null);
      if (!ban) {
        await interaction.editReply({ embeds: [embeds.warning('Niet gebanned', `<@${target.id}> staat niet op de banlijst.`)] });
        return;
      }

      await interaction.guild.bans.remove(target.id, `Unban door ${interaction.user.tag}`);

      await interaction.editReply({
        embeds: [embeds.success('Gebruiker unbanned', `<@${target.id}> is unbanned.`)],
      });

      await logger.auditLog(client, {
        action: 'UNBAN',
        discordId: target.id,
        details: `Uitgevoerd door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
