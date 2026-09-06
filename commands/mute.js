const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { hasPermission, parseDuration } = require("../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout (mute) a member (Admin/Staff only)")
    .addUserOption((opt) => opt.setName("user").setDescription("The user to mute").setRequired(true))
    .addStringOption((opt) =>
      opt.setName("duration").setDescription("Duration e.g. 10m, 1h, 1d").setRequired(true)
    )
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason for mute")),

  async execute(interaction) {
    if (!hasPermission(interaction.member))
      return interaction.reply({ content: "❌ You don't have permission to mute members.", ephemeral: true });

    const target = interaction.options.getMember("user");
    const durationStr = interaction.options.getString("duration");
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!target) return interaction.reply({ content: "❌ User not found.", ephemeral: true });

    const duration = parseDuration(durationStr);
    if (!duration)
      return interaction.reply({ content: "❌ Invalid duration. Examples: `10m`, `1h`, `1d`", ephemeral: true });
    if (duration > 28 * 24 * 3600 * 1000)
      return interaction.reply({ content: "❌ Max timeout is 28 days.", ephemeral: true });

    await target.timeout(duration, reason);
    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle("🔇 Member Muted")
      .setDescription(`**${target.user.tag}** has been muted for **${durationStr}**.\n**Reason:** ${reason}`);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    if (!hasPermission(message.member))
      return message.reply("❌ You don't have permission to mute members.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Please mention a user. Usage: `$mute @user 10m reason`");

    const durationStr = args[1];
    if (!durationStr) return message.reply("❌ Please provide a duration. Usage: `$mute @user 10m reason`");

    const duration = parseDuration(durationStr);
    if (!duration) return message.reply("❌ Invalid duration. Examples: `10m`, `1h`, `1d`");
    if (duration > 28 * 24 * 3600 * 1000) return message.reply("❌ Max timeout is 28 days.");

    const reason = args.slice(2).join(" ") || "No reason provided";
    await target.timeout(duration, reason);
    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle("🔇 Member Muted")
      .setDescription(`**${target.user.tag}** has been muted for **${durationStr}**.\n**Reason:** ${reason}`);
    await message.reply({ embeds: [embed] });
  },
};
