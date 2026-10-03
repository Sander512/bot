// bot/commands/untimeout.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('[Management] Haal iemand uit de timeout')
    .setDMPermission(false)
    .addUserOption((opt) => opt.setName('gebruiker').setDescription('Wie?').setRequired(true)),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('gebruiker', true);

    try {
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.editReply({ embeds: [embeds.error('Niet gevonden', `<@${target.id}> zit niet in de server.`)] });
        return;
      }
      if (!member.communicationDisabledUntilTimestamp || member.communicationDisabledUntilTimestamp < Date.now()) {
        await interaction.editReply({ embeds: [embeds.warning('Geen timeout', `<@${target.id}> zit niet in de timeout.`)] });
        return;
      }

      await member.timeout(null, `Timeout opgeheven door ${interaction.user.tag}`);

      await interaction.editReply({ embeds: [embeds.success('Timeout opgeheven', `<@${target.id}> kan weer praten.`)] });

      await logger.auditLog(client, {
        action: 'UNTIMEOUT',
        discordId: target.id,
        details: `Uitgevoerd door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
