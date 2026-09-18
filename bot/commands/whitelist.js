// bot/commands/whitelist.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('[Management] Beheer de join-whitelist')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Voeg een speler toe aan de whitelist')
        .addUserOption((opt) => opt.setName('discord').setDescription('De Discord gebruiker').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Verwijder een speler van de whitelist')
        .addUserOption((opt) => opt.setName('discord').setDescription('De Discord gebruiker').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Bekijk de volledige whitelist')),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sub = interaction.options.getSubcommand();

    try {
      if (sub === 'list') {
        const { total, entries } = await api.getWhitelist();

        if (total === 0) {
          await interaction.editReply({ embeds: [embeds.info('Whitelist leeg', 'Er staan nog geen spelers op de whitelist.')] });
          return;
        }

        const lines = entries
          .slice(0, 25)
          .map((e) => `${e.discordId ? `<@${e.discordId}>` : 'Onbekend'} — Roblox \`${e.robloxUsername || e.robloxId}\``);

        await interaction.editReply({
          embeds: [
            embeds.info(
              `Whitelist (${total})`,
              lines.join('\n') + (total > 25 ? `\n...en ${total - 25} meer` : '')
            ),
          ],
        });
        return;
      }

      const target = interaction.options.getUser('discord', true);
      const verification = await api.getVerificationByDiscordId(target.id);
      if (!verification?.verified) {
        await interaction.editReply({
          embeds: [embeds.error('Speler niet geverifieerd', `<@${target.id}> heeft geen gekoppeld Roblox account.`)],
        });
        return;
      }

      if (sub === 'add') {
        await api.addToWhitelist(verification.robloxId, verification.robloxUsername, target.id, interaction.user.id);
        await interaction.editReply({
          embeds: [embeds.success('Toegevoegd', `<@${target.id}> (${verification.robloxUsername}) staat nu op de whitelist.`)],
        });
        await logger.auditLog(client, {
          action: 'WHITELIST_ADD',
          discordId: target.id,
          robloxId: verification.robloxId,
          details: `Door <@${interaction.user.id}>`,
        });
      } else if (sub === 'remove') {
        await api.removeFromWhitelist(verification.robloxId, interaction.user.id);
        await interaction.editReply({
          embeds: [embeds.success('Verwijderd', `<@${target.id}> (${verification.robloxUsername}) staat niet meer op de whitelist.`)],
        });
        await logger.auditLog(client, {
          action: 'WHITELIST_REMOVE',
          discordId: target.id,
          robloxId: verification.robloxId,
          details: `Door <@${interaction.user.id}>`,
        });
      }
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
