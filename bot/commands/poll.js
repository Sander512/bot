// bot/commands/poll.js
// Simpele reactie-poll: de bot zet 1️⃣ 2️⃣ 3️⃣ ... onder het bericht.
const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../utils/embeds');

const NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

module.exports = {
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName('poll')
      .setDescription('Start een poll met stemknoppen (reacties)')
      .setDMPermission(false)
      .addStringOption((opt) => opt.setName('vraag').setDescription('De vraag').setRequired(true).setMaxLength(200))
      .addStringOption((opt) => opt.setName('optie1').setDescription('Optie 1').setRequired(true).setMaxLength(100))
      .addStringOption((opt) => opt.setName('optie2').setDescription('Optie 2').setRequired(true).setMaxLength(100));

    for (let i = 3; i <= 5; i++) {
      builder.addStringOption((opt) =>
        opt.setName(`optie${i}`).setDescription(`Optie ${i}`).setRequired(false).setMaxLength(100)
      );
    }
    return builder;
  })(),

  async execute(interaction) {
    const question = interaction.options.getString('vraag', true);
    const options = [];
    for (let i = 1; i <= 5; i++) {
      const value = interaction.options.getString(`optie${i}`);
      if (value) options.push(value);
    }

    const lines = options.map((o, i) => `${NUMBERS[i]}  ${o}`).join('\n\n');

    await interaction.reply({
      embeds: [
        embeds.custom({
          title: `📊 ${question}`,
          description: `${lines}\n\n*Stem door op een nummer te reageren.*`,
          footer: `Poll van ${interaction.user.displayName ?? interaction.user.username}`,
        }),
      ],
    });

    const message = await interaction.fetchReply();
    for (let i = 0; i < options.length; i++) {
      await message.react(NUMBERS[i]).catch(() => {});
    }
  },
};
