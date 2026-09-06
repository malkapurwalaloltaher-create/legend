const { SlashCommandBuilder, ChannelType } = require("discord.js");
const { hasPermission, parseDuration } = require("../utils");
const loopManager = require("../managers/loopManager");

const MIN_MS = 5 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setyap")
    .setDescription("Start the bot yapping in a channel on a set interval (Admin only)")
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("Channel to yap in").setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption((opt) =>
      opt.setName("interval").setDescription("How often to yap — e.g. 30m, 1h, 2h").setRequired(true)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member))
      return interaction.reply({ content: "❌ Admin/Staff only.", ephemeral: true });

    const channel = interaction.options.getChannel("channel");
    const intervalStr = interaction.options.getString("interval");
    const intervalMs = parseDuration(intervalStr);

    if (!intervalMs) return interaction.reply({ content: "❌ Invalid interval. Use: `5m`, `30m`, `1h`, etc.", ephemeral: true });
    if (intervalMs < MIN_MS) return interaction.reply({ content: "❌ Minimum interval is 5 minutes.", ephemeral: true });

    loopManager.setLoop(interaction.guildId, "yap", channel.id, intervalMs);
    await interaction.reply({ content: `✅ Bot will yap in ${channel} every **${intervalStr}**! 🗣️`, ephemeral: true });
  },

  async executePrefix(message, args) {
    if (!hasPermission(message.member)) return message.reply("❌ Admin/Staff only.");

    const channel = message.mentions.channels.first();
    const intervalStr = args.find((a) => /^\d+[smhd]$/i.test(a));

    if (!channel) return message.reply("❌ Mention a channel. Usage: `$setyap #channel 30m`");
    const intervalMs = parseDuration(intervalStr || "");
    if (!intervalMs) return message.reply("❌ Invalid interval. Use: `5m`, `30m`, `1h`, etc.");
    if (intervalMs < MIN_MS) return message.reply("❌ Minimum interval is 5 minutes.");

    loopManager.setLoop(message.guildId, "yap", channel.id, intervalMs);
    await message.reply(`✅ Bot will yap in ${channel} every **${intervalStr}**! 🗣️`);
  },
};
