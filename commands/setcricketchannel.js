const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require("discord.js");
const sportsLoopManager = require("../managers/sportsLoopManager");
const DashboardSportsConfig = require("../models/DashboardSportsConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setcricketchannel")
    .setDescription("Set and lock the cricket live score channel")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel for cricket live scores")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const settings = sportsLoopManager.getSettings(interaction.guildId, "cricket");
    if (settings.locked && settings.channelId) {
      return interaction.reply({
        content: `⚠️ Cricket channel is already locked to <#${settings.channelId}>. Use /unlockcricketchannel first if you want to change it.`,
        ephemeral: true,
      });
    }

    const channel = interaction.options.getChannel("channel");
    sportsLoopManager.setChannel(interaction.guildId, "cricket", channel.id);
    sportsLoopManager.setLocked(interaction.guildId, "cricket", true);

    await DashboardSportsConfig.findOneAndUpdate(
      { guildId: interaction.guildId },
      {
        $set: {
          cricketChannelId: channel.id,
          cricketChannelName: channel.name,
          cricketEnabled: true,
        },
      },
      { upsert: true, new: true }
    );

    sportsLoopManager.refreshGuildLoops(interaction.guildId);

    await interaction.reply(`✅ Cricket live score channel set and locked to ${channel}`);
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /setcricketchannel");
  },
};
