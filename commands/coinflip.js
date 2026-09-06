const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin — pick heads or tails!")
    .addStringOption((opt) =>
      opt
        .setName("choice")
        .setDescription("Your pick")
        .setRequired(true)
        .addChoices({ name: "Heads 🪙", value: "heads" }, { name: "Tails 🪙", value: "tails" })
    ),

  async execute(interaction) {
    const choice = interaction.options.getString("choice");
    const result = Math.random() < 0.5 ? "heads" : "tails";
    const won = choice === result;
    const embed = new EmbedBuilder()
      .setTitle("🪙 Coin Flip")
      .setColor(won ? 0x00ff00 : 0xff0000)
      .setDescription(
        `You picked: **${choice}**\nResult: **${result}**\n\n${won ? "✅ You guessed right!" : "❌ Better luck next time!"}`
      );
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    const choice = args[0]?.toLowerCase();
    if (!["heads", "tails"].includes(choice))
      return message.reply("❌ Please choose **heads** or **tails**. Usage: `$coinflip heads`");

    const result = Math.random() < 0.5 ? "heads" : "tails";
    const won = choice === result;
    const embed = new EmbedBuilder()
      .setTitle("🪙 Coin Flip")
      .setColor(won ? 0x00ff00 : 0xff0000)
      .setDescription(
        `You picked: **${choice}**\nResult: **${result}**\n\n${won ? "✅ You guessed right!" : "❌ Better luck next time!"}`
      );
    await message.reply({ embeds: [embed] });
  },
};
