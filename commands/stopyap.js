const { SlashCommandBuilder } = require("discord.js");
const { hasPermission } = require("../utils");
const loopManager = require("../managers/loopManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stopyap")
    .setDescription("Stop the bot from yapping (Admin only)"),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: "❌ Admin/Staff only.", ephemeral: true });
    }

    const status = await loopManager.getStatus(interaction.guildId, "yap");

    if (!status?.active) {
      return interaction.reply({ content: "❌ Yap mode isn't running.", ephemeral: true });
    }

    await loopManager.clearLoop(interaction.guildId, "yap");

    await interaction.reply({
      content: "✅ Yap mode stopped. The bot will shut up now. 🤫",
      ephemeral: true,
    });
  },

  async executePrefix(message) {
    if (!hasPermission(message.member)) {
      return message.reply("❌ Admin/Staff only.");
    }

    const status = await loopManager.getStatus(message.guildId, "yap");

    if (!status?.active) {
      return message.reply("❌ Yap mode isn't running.");
    }

    await loopManager.clearLoop(message.guildId, "yap");

    await message.reply("✅ Yap mode stopped. The bot will shut up now. 🤫");
  },
};
