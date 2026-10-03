// bot/commands/clear.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('[Management] Verwijder berichten uit dit kanaal')
    .setDMPermission(false)
    .addIntegerOption((opt) =>
      opt.setName('aantal').setDescription('Hoeveel berichten (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)
    )
    .addUserOption((opt) =>
      opt.setName('gebruiker').setDescription('Alleen berichten van deze gebruiker').setRequired(false)
    ),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const amount = interaction.options.getInteger('aantal', true);
    const user = interaction.options.getUser('gebruiker');
    const channel = interaction.channel;

    try {
      let toDelete;
      if (user) {
        const recent = await channel.messages.fetch({ limit: 100 });
        toDelete = [...recent.filter((m) => m.author.id === user.id).values()].slice(0, amount);
      } else {
        toDelete = amount;
      }

      // true = berichten ouder dan 14 dagen (kan Discord niet in bulk) overslaan
      const deleted = await channel.bulkDelete(toDelete, true);

      await interaction.editReply({
        embeds: [
          embeds.success(
            'Berichten verwijderd',
            `**${deleted.size}** bericht(en) verwijderd${user ? ` van <@${user.id}>` : ''}.\nBerichten ouder dan 14 dagen kan Discord niet in één keer verwijderen.`
          ),
        ],
      });

      await logger.auditLog(client, {
        action: 'CLEAR',
        discordId: user?.id,
        details: `${deleted.size} bericht(en) in <#${channel.id}> — door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
