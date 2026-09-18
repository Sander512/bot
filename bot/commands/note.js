// bot/commands/note.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('[Staff] Voeg een staff-notitie toe aan een speler')
    .addUserOption((opt) => opt.setName('discord').setDescription('De Discord gebruiker').setRequired(true))
    .addStringOption((opt) => opt.setName('notitie').setDescription('De notitie').setRequired(true)),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('discord', true);
    const note = interaction.options.getString('notitie', true);

    try {
      const verification = await api.getVerificationByDiscordId(target.id).catch(() => null);
      const robloxId = verification?.verified ? verification.robloxId : undefined;

      await api.createNote(target.id, robloxId, note, interaction.user.id);

      await interaction.editReply({
        embeds: [embeds.success('Notitie toegevoegd', `Notitie toegevoegd aan <@${target.id}>. Zichtbaar via \`/userinfo\`.`)],
      });

      await logger.auditLog(client, {
        action: 'NOTE_ADD',
        discordId: target.id,
        robloxId,
        details: `${note} door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
