const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require("discord.js");
const sportsLoopManager = require("../managers/sportsLoopManager");
const DashboardSportsConfig = require("../models/DashboardSportsConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setfootballchannel")
    .setDescription("Set and lock the football live score channel")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel for football live scores")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const settings = sportsLoopManager.getSettings(interaction.guildId, "football");
    if (settings.locked && settings.channelId) {
      return interaction.reply({
        content: `⚠️ Football channel is already locked to <#${settings.channelId}>. Use /unlockfootballchannel first if you want to change it.`,
        ephemeral: true,
      });
    }

    const channel = interaction.options.getChannel("channel");
    sportsLoopManager.setChannel(interaction.guildId, "football", channel.id);
    sportsLoopManager.setLocked(interaction.guildId, "football", true);

    await DashboardSportsConfig.findOneAndUpdate(
      { guildId: interaction.guildId },
      {
        $set: {
          footballChannelId: channel.id,
          footballChannelName: channel.name,
          footballEnabled: true,
        },
      },
      { upsert: true, new: true }
    );

    sportsLoopManager.refreshGuildLoops(interaction.guildId);

    await interaction.reply(`✅ Football live score channel set and locked to ${channel}`);
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /setfootballchannel");
  },
};
