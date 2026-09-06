const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function buildEmbed(original, reversed) {
  return new EmbedBuilder()
    .setTitle("🔄 Text Reversed")
    .setColor(0xff69b4)
    .addFields(
      { name: "Original", value: original },
      { name: "Reversed", value: reversed },
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reverse")
    .setDescription("Reverse any text")
    .addStringOption((opt) =>
      opt.setName("text").setDescription("The text to reverse").setRequired(true)
    ),

  async execute(interaction) {
    const text = interaction.options.getString("text");
    await interaction.reply({ embeds: [buildEmbed(text, [...text].reverse().join(""))] });
  },

  async executePrefix(message, args) {
    const text = args.join(" ");
    if (!text) return message.reply("❌ Please provide some text. Usage: `$reverse Hello World`");
    await message.reply({ embeds: [buildEmbed(text, [...text].reverse().join(""))] });
  },
};
