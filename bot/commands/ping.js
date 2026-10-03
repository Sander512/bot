// bot/commands/ping.js
const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check of de bot wakker is'),

  async execute(interaction, { client }) {
    const latency = Math.max(0, Date.now() - interaction.createdTimestamp);
    const ws = client.ws.ping >= 0 ? `${Math.round(client.ws.ping)} ms` : 'nog onbekend';

    await interaction.reply({
      embeds: [embeds.info('🏓 Pong!', `Reactietijd: **${latency} ms**\nGateway: **${ws}**`)],
    });
  },
};
