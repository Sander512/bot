// bot/commands/warn.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('[Staff] Geef een speler een waarschuwing')
    .addUserOption((opt) => opt.setName('discord').setDescription('De Discord gebruiker').setRequired(true))
    .addStringOption((opt) => opt.setName('reden').setDescription('Reden voor de waarschuwing').setRequired(true)),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('discord', true);
    const reason = interaction.options.getString('reden', true);

    try {
      // Roblox account is optional here — a warning doesn't require the
      // player to be verified or online, unlike the queued admin commands.
      const verification = await api.getVerificationByDiscordId(target.id).catch(() => null);
      const robloxId = verification?.verified ? verification.robloxId : undefined;

      const warning = await api.createWarning(target.id, robloxId, reason, interaction.user.id);

      await interaction.editReply({
        embeds: [
          embeds.success('Waarschuwing gegeven', `<@${target.id}> heeft een waarschuwing gekregen.\nReden: ${reason}\nWaarschuwing ID: \`${warning.id}\``),
        ],
      });

      await logger.auditLog(client, {
        action: 'WARN',
        discordId: target.id,
        robloxId,
        details: `${reason} door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
