const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const sportsLoopManager = require("../managers/sportsLoopManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlockcricketchannel")
    .setDescription("Unlock the cricket live score channel so it can be changed"),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    sportsLoopManager.setLocked(interaction.guildId, "cricket", false);
    await interaction.reply("✅ Cricket channel unlocked. You can now use /setcricketchannel again.");
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /unlockcricketchannel");
  },
};
