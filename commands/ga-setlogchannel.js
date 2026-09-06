const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const GuildConfig = require("../models/GuildConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxsetlogchannel")
    .setDescription("Set the giveaway log channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("Log channel").setRequired(true)
    ),

  async execute(interaction) {
    if (!(await ensureAdmin(interaction))) return;

    const channel = interaction.options.getChannel("channel");

    await GuildConfig.findOneAndUpdate(
      { guildId: interaction.guild.id },
      { guildId: interaction.guild.id, logChannelId: channel.id },
      { upsert: true, new: true }
    );

    await interaction.reply({
      content: `✅ Giveaway log channel set to <#${channel.id}>.`,
      ephemeral: true
    });
  }
};
