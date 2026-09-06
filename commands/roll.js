const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Roll a dice")
    .addIntegerOption((opt) =>
      opt
        .setName("sides")
        .setDescription("Number of sides (default: 6)")
        .setMinValue(2)
        .setMaxValue(1000)
    ),

  async execute(interaction) {
    const sides = interaction.options.getInteger("sides") ?? 6;
    const result = Math.floor(Math.random() * sides) + 1;
    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle("🎲 Dice Roll")
      .setDescription(`Rolling a **${sides}-sided** dice...\n\n**Result: ${result}**`);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const sides = parseInt(args[0]) || 6;
    if (sides < 2 || sides > 1000) return message.reply("❌ Sides must be between 2 and 1000.");
    const result = Math.floor(Math.random() * sides) + 1;
    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle("🎲 Dice Roll")
      .setDescription(`Rolling a **${sides}-sided** dice...\n\n**Result: ${result}**`);
    await message.reply({ embeds: [embed] });
  },
};
