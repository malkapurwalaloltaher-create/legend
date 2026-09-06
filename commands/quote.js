const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

async function fetchQuote() {
  const res = await fetch("https://zenquotes.io/api/random");
  const data = await res.json();
  const { q, a } = data[0];
  return new EmbedBuilder()
    .setColor(0xf5a623)
    .setDescription(`*"${q}"*`)
    .setFooter({ text: `— ${a}` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription("Get a random inspirational quote"),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      await interaction.editReply({ embeds: [await fetchQuote()] });
    } catch {
      await interaction.editReply("❌ Couldn't fetch a quote right now.");
    }
  },

  async executePrefix(message) {
    const reply = await message.reply("Fetching a quote...");
    try {
      await reply.edit({ content: "", embeds: [await fetchQuote()] });
    } catch {
      await reply.edit("❌ Couldn't fetch a quote right now.");
    }
  },
};
