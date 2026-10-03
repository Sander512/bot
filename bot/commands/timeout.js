// bot/commands/timeout.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

const MAX_MINUTES = 28 * 24 * 60; // Discord-limiet: 28 dagen

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('[Management] Zet iemand tijdelijk in de timeout')
    .setDMPermission(false)
    .addUserOption((opt) => opt.setName('gebruiker').setDescription('Wie?').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('minuten').setDescription('Hoe lang (in minuten, max 40320)').setRequired(true).setMinValue(1).setMaxValue(MAX_MINUTES)
    )
    .addStringOption((opt) => opt.setName('reden').setDescription('Reden').setRequired(false).setMaxLength(300)),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('gebruiker', true);
    const minutes = interaction.options.getInteger('minuten', true);
    const reason = interaction.options.getString('reden') || 'Geen reden opgegeven';

    if (target.id === interaction.user.id || target.id === client.user.id) {
      await interaction.editReply({ embeds: [embeds.error('Dat kan niet', 'Kies iemand anders.')] });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.editReply({ embeds: [embeds.error('Niet gevonden', `<@${target.id}> zit niet in de server.`)] });
        return;
      }
      if (!member.moderatable) {
        await interaction.editReply({
          embeds: [embeds.error('Niet mogelijk', 'Ik kan deze gebruiker geen timeout geven (rol staat hoger dan die van mij, of heeft Administrator).')],
        });
        return;
      }

      await member.timeout(minutes * 60 * 1000, `${reason} — door ${interaction.user.tag}`);

      await interaction.editReply({
        embeds: [embeds.success('Timeout gegeven', `<@${target.id}> is **${minutes} min** in de timeout.\nReden: ${reason}`)],
      });

      await logger.auditLog(client, {
        action: 'TIMEOUT',
        discordId: target.id,
        details: `${minutes} min — ${reason} — door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
