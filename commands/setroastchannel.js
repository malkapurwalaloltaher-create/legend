const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasPermission } = require("../utils");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "../data/roast-config.json");

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setroastchannel")
    .setDescription("Set or clear the channel where roasts are allowed (Admin only)")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("The channel to allow roasts in (leave empty to clear restriction)")
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: "❌ You need to be an Admin or Staff to use this.", ephemeral: true });
    }

    const config = getConfig();
    const channel = interaction.options.getChannel("channel");

    if (!channel) {
      if (config[interaction.guildId]) {
        delete config[interaction.guildId].roastChannel;
        saveConfig(config);
      }
      return interaction.reply({ content: "✅ Roast channel restriction cleared — roasts can now happen anywhere.", ephemeral: true });
    }

    if (!config[interaction.guildId]) config[interaction.guildId] = {};
    config[interaction.guildId].roastChannel = channel.id;
    saveConfig(config);

    await interaction.reply({ content: `✅ Roast channel set to ${channel}. Roasts will only work there now. 🔥`, ephemeral: true });
  },

  async executePrefix(message, args) {
    if (!hasPermission(message.member)) {
      return message.reply("❌ You need to be an Admin or Staff to use this.");
    }

    const config = getConfig();
    const channel = message.mentions.channels.first();

    if (!channel) {
      if (config[message.guildId]) {
        delete config[message.guildId].roastChannel;
        saveConfig(config);
      }
      return message.reply("✅ Roast channel restriction cleared — roasts can now happen anywhere.");
    }

    if (!config[message.guildId]) config[message.guildId] = {};
    config[message.guildId].roastChannel = channel.id;
    saveConfig(config);

    await message.reply(`✅ Roast channel set to ${channel}. Roasts will only work there now. 🔥`);
  },
};
