const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const autoMessageManager = require("../managers/autoMessageManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stopautomessage")
    .setDescription("Stop the 12-hour auto message"),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    autoMessageManager.stopAutoMessage(interaction.guildId);
    await interaction.reply("✅ Auto message stopped.");
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /stopautomessage");
  },
};
