const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { hasPermission } = require("../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server (Admin/Staff only)")
    .addUserOption((opt) => opt.setName("user").setDescription("The user to ban").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason for ban")),

  async execute(interaction) {
    if (!hasPermission(interaction.member))
      return interaction.reply({ content: "❌ You don't have permission to ban members.", ephemeral: true });

    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!target) return interaction.reply({ content: "❌ User not found.", ephemeral: true });
    if (!target.bannable) return interaction.reply({ content: "❌ I cannot ban this user.", ephemeral: true });

    await target.ban({ reason });
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🔨 Member Banned")
      .setDescription(`**${target.user.tag}** has been banned.\n**Reason:** ${reason}`);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    if (!hasPermission(message.member))
      return message.reply("❌ You don't have permission to ban members.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Please mention a user. Usage: `$ban @user reason`");
    if (!target.bannable) return message.reply("❌ I cannot ban this user.");

    const reason = args.slice(1).join(" ") || "No reason provided";
    await target.ban({ reason });
    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🔨 Member Banned")
      .setDescription(`**${target.user.tag}** has been banned.\n**Reason:** ${reason}`);
    await message.reply({ embeds: [embed] });
  },
};
