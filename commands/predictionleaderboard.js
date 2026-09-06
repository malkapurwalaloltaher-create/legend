const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require("discord.js");
const predictionManager = require("../managers/predictionManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("predictionleaderboard")
    .setDescription("Show the top prediction points leaderboard"),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const board = await predictionManager.getLeaderboard(interaction.guildId);

    if (!board.length) {
      return interaction.reply({ content: "ℹ️ No prediction points yet.", ephemeral: true });
    }

    const text = board
      .map(([userId, points], index) => `${index + 1}. <@${userId}> — **${points}** pts`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("💰 Prediction Leaderboard")
      .setDescription(text)
      .setColor(0xf1c40f)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /predictionleaderboard");
  },
};
