const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require("discord.js");
const LoopConfig = require("../models/LoopConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setconfesschannel")
    .setDescription("Set the anonymous confession channel")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel where confessions will be posted")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel");

    await LoopConfig.findOneAndUpdate(
      { guildId: interaction.guildId },
      { $set: { confessChannelId: channel.id } },
      { upsert: true, new: true }
    );

    await interaction.reply({
      content: `✅ Confession channel set to ${channel}`,
      ephemeral: true,
    });
  },

  async executePrefix(message) {
    await message.reply("Use slash command: `/setconfesschannel`");
  },
};
