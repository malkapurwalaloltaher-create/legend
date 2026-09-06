const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { hasPermission } = require("../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server (Admin/Staff only)")
    .addUserOption((opt) => opt.setName("user").setDescription("The user to kick").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason for kick")),

  async execute(interaction) {
    if (!hasPermission(interaction.member))
      return interaction.reply({ content: "❌ You don't have permission to kick members.", ephemeral: true });

    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    if (!target) return interaction.reply({ content: "❌ User not found.", ephemeral: true });
    if (!target.kickable) return interaction.reply({ content: "❌ I cannot kick this user.", ephemeral: true });

    await target.kick(reason);
    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle("👢 Member Kicked")
      .setDescription(`**${target.user.tag}** has been kicked.\n**Reason:** ${reason}`);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message, args) {
    if (!hasPermission(message.member))
      return message.reply("❌ You don't have permission to kick members.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Please mention a user. Usage: `$kick @user reason`");
    if (!target.kickable) return message.reply("❌ I cannot kick this user.");

    const reason = args.slice(1).join(" ") || "No reason provided";
    await target.kick(reason);
    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle("👢 Member Kicked")
      .setDescription(`**${target.user.tag}** has been kicked.\n**Reason:** ${reason}`);
    await message.reply({ embeds: [embed] });
  },
};
