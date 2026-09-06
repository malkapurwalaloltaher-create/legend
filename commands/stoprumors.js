const { SlashCommandBuilder } = require("discord.js");
const { hasPermission } = require("../utils");
const loopManager = require("../managers/loopManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stoprumors")
    .setDescription("Stop the bot from spreading rumors (Admin only)"),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: "❌ Admin/Staff only.", ephemeral: true });
    }

    const status = await loopManager.getStatus(interaction.guildId, "rumors");

    if (!status?.active) {
      return interaction.reply({ content: "❌ Rumors mode isn't running.", ephemeral: true });
    }

    await loopManager.clearLoop(interaction.guildId, "rumors");

    await interaction.reply({
      content: "✅ Rumors stopped. The drama is over. 🕊️",
      ephemeral: true,
    });
  },

  async executePrefix(message) {
    if (!hasPermission(message.member)) {
      return message.reply("❌ Admin/Staff only.");
    }

    const status = await loopManager.getStatus(message.guildId, "rumors");

    if (!status?.active) {
      return message.reply("❌ Rumors mode isn't running.");
    }

    await loopManager.clearLoop(message.guildId, "rumors");

    await message.reply("✅ Rumors stopped. The drama is over. 🕊️");
  },
};
