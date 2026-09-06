const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const predictionManager = require("../managers/predictionManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("closeprediction")
    .setDescription("Close the active prediction and award points")
    .addIntegerOption((opt) =>
      opt
        .setName("winner")
        .setDescription("Winning option number")
        .setRequired(true)
        .addChoices(
          { name: "Option 1", value: 1 },
          { name: "Option 2", value: 2 }
        )
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const winner = interaction.options.getInteger("winner") - 1;
    const result = await predictionManager.closePrediction(interaction.guildId, winner);

    if (!result.ok) {
      return interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
    }

    const channel = await interaction.client.channels.fetch(result.prediction.channelId).catch(() => null);
    if (channel) {
      const msg = await channel.messages.fetch(result.prediction.messageId).catch(() => null);
      if (msg) {
        await msg.edit({
          embeds: [predictionManager.buildPredictionEmbed(result.prediction, { closed: true, winnerIndex: winner })],
          components: predictionManager.buildPredictionButtons(false),
        });
      }
    }

    await interaction.reply({
      content: `✅ Prediction closed. Winner: **${result.prediction.options[winner]}**\n🏆 Correct voters earned 10 points.`,
      ephemeral: true,
    });
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /closeprediction");
  },
};
