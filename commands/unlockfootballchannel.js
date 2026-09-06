const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const sportsLoopManager = require("../managers/sportsLoopManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unlockfootballchannel")
    .setDescription("Unlock the football live score channel so it can be changed"),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    sportsLoopManager.setLocked(interaction.guildId, "football", false);
    await interaction.reply("✅ Football channel unlocked. You can now use /setfootballchannel again.");
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /unlockfootballchannel");
  },
};
