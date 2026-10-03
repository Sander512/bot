// bot/commands/ban.js
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../utils/embeds');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('[Management] Ban iemand van de server')
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName('gebruiker').setDescription('De gebruiker die je wilt bannen').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reden').setDescription('Reden voor de ban').setRequired(true).setMaxLength(500)
    ),

  async execute(interaction, { client }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const target = interaction.options.getUser('gebruiker', true);
    const reason = interaction.options.getString('reden', true);

    if (target.id === interaction.user.id) {
      await interaction.editReply({ embeds: [embeds.error('Dat kan niet', 'Je kunt jezelf niet bannen.')] });
      return;
    }
    if (target.id === client.user.id) {
      await interaction.editReply({ embeds: [embeds.error('Dat kan niet', 'Je kunt de bot niet bannen.')] });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (member && !member.bannable) {
        await interaction.editReply({
          embeds: [embeds.error('Niet mogelijk', 'Ik kan deze gebruiker niet bannen (rol staat hoger dan die van mij of is de eigenaar).')],
        });
        return;
      }

      await interaction.guild.members.ban(target.id, { reason: `${reason} — door ${interaction.user.tag}` });

      await interaction.editReply({
        embeds: [embeds.success('Gebruiker gebanned', `<@${target.id}> is gebanned.\nReden: ${reason}`)],
      });

      await logger.auditLog(client, {
        action: 'BAN',
        discordId: target.id,
        details: `Reden: ${reason} — door <@${interaction.user.id}>`,
      });
    } catch (err) {
      await interaction.editReply({ embeds: [embeds.error('Actie mislukt', err.message)] });
    }
  },
};
