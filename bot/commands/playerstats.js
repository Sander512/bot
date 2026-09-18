// bot/commands/playerstats.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playerstats')
    .setDescription('[Staff] Bekijk cash, bank, XP en playtime van een speler')
    .addUserOption((opt) =>
      opt.setName('discord').setDescription('De Discord gebruiker').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('discord', true);

    try {
      const verification = await api.getVerificationByDiscordId(target.id);
      if (!verification?.verified) {
        await interaction.editReply({
          embeds: [embeds.error('Speler niet geverifieerd', `<@${target.id}> heeft geen gekoppeld Roblox account.`)],
        });
        return;
      }

      // Stats are reported periodically by Roblox while the player is
      // online (see the "STATS REPORTING" loop in ForeverIntegration.server.lua),
      // so this works even if the player just logged off — the numbers just
      // reflect their last online moment instead of live data.
      const stats = await api.getPlayerStats(verification.robloxId);

      if (!stats.found) {
        await interaction.editReply({
          embeds: [
            embeds.warning(
              'Nog geen data',
              `Er is nog geen stats-snapshot voor **${verification.robloxUsername}**. De speler moet minstens één keer online zijn geweest sinds deze functie is toegevoegd.`
            ),
          ],
        });
        return;
      }

      const updatedAgo = Math.max(0, Math.round((Date.now() - stats.updatedAt) / 60000));

      await interaction.editReply({
        embeds: [
          embeds
            .info(`Stats van ${stats.robloxUsername || verification.robloxUsername}`)
            .addFields(
              { name: 'Contant', value: `${stats.cash}`, inline: true },
              { name: 'Bank', value: `${stats.bank}`, inline: true },
              { name: 'XP', value: `${stats.xp}`, inline: true },
              { name: 'Playtime', value: `${stats.playtimeMinutes} min`, inline: true },
              { name: 'Laatste update', value: `${updatedAgo} min geleden`, inline: true }
            ),
        ],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
