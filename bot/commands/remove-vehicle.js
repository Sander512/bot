// bot/commands/remove-vehicle.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const api = require('../utils/api');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');
const { VEHICLES, isValidVehicle } = require('../../shared/vehicles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-vehicle')
    .setDescription('[Management] Verwijder een voertuig van een speler')
    .addUserOption((opt) =>
      opt.setName('discord').setDescription('De Discord gebruiker').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('voertuig').setDescription('Het voertuig (typ om te zoeken)').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const matches = VEHICLES.filter((v) => v.toLowerCase().includes(focused)).slice(0, 25);
    await interaction.respond(matches.map((v) => ({ name: v, value: v })));
  },

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('discord', true);
    const vehicle = interaction.options.getString('voertuig', true);

    if (!isValidVehicle(vehicle)) {
      await interaction.editReply({
        embeds: [embeds.error('Ongeldig voertuig', `"${vehicle}" staat niet op de whitelist.`)],
      });
      return;
    }

    try {
      const verification = await api.getVerificationByDiscordId(target.id);
      if (!verification?.verified) {
        await interaction.editReply({
          embeds: [embeds.error('Speler niet geverifieerd', `<@${target.id}> heeft geen gekoppeld Roblox account.`)],
        });
        return;
      }

      const command = await api.createCommand('remove_vehicle', verification.robloxId, { vehicle }, interaction.user.id);

      await interaction.editReply({
        embeds: [
          embeds.success(
            'Voertuig verwijderd',
            `**${vehicle}** wordt verwijderd bij <@${target.id}> (${verification.robloxUsername}).\nCommand ID: \`${command.id}\``
          ),
        ],
      });

      await logger.auditLog(client, {
        action: 'REMOVE_VEHICLE',
        discordId: target.id,
        robloxId: verification.robloxId,
        details: `${vehicle} door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
