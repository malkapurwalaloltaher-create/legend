const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const sportsLoopManager = require("../managers/sportsLoopManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("footballlive")
    .setDescription("Update the football live scoreboard now"),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await sportsLoopManager.postFootballLive(interaction.guildId, true);
      await interaction.editReply(result.posted ? `✅ ${result.reason}` : `ℹ️ ${result.reason}`);
    } catch (err) {
      console.error("footballlive error:", err);
      await interaction.editReply(`❌ Couldn't fetch football live scores.\n\`${err?.message || "Unknown error"}\``);
    }
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /footballlive");
  },
};
