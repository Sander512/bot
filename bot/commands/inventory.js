// bot/commands/inventory.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('[Staff] Bekijk de Ox inventory van een speler')
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

      const command = await api.createCommand('check_inventory', verification.robloxId, {}, interaction.user.id);

      // Read-back command — needs the player online in-game to answer.
      const result = await api.waitForCommandResult(command.id, 8000);

      if (!result) {
        await interaction.editReply({
          embeds: [
            embeds.warning(
              'Geen antwoord (nog)',
              `Command \`${command.id}\` staat in de wachtrij, maar Roblox heeft nog niet gereageerd binnen 8 seconden. Is <@${target.id}> online in-game?`
            ),
          ],
        });
        return;
      }

      if (result.status !== 'completed') {
        await interaction.editReply({
          embeds: [embeds.error('Ophalen mislukt', result.result || `Status: ${result.status}`)],
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          embeds.info(`Inventory van ${verification.robloxUsername}`, result.result || 'Geen data ontvangen.'),
        ],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
