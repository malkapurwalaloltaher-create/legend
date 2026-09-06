const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { hasPermission } = require("../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by their Discord ID (Admin/Staff only)")
    .addStringOption((opt) =>
      opt.setName("userid").setDescription("The user's Discord ID").setRequired(true)
    )
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason for unban")),

  async execute(interaction) {
    if (!hasPermission(interaction.member))
      return interaction.reply({ content: "❌ You don't have permission to unban members.", ephemeral: true });

    const userId = interaction.options.getString("userid");
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    try {
      const ban = await interaction.guild.bans.fetch(userId);
      await interaction.guild.members.unban(userId, reason);
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Member Unbanned")
        .setDescription(`**${ban.user.tag}** has been unbanned.\n**Reason:** ${reason}`);
      await interaction.reply({ embeds: [embed] });
    } catch {
      await interaction.reply({ content: "❌ Could not find a ban for that user ID.", ephemeral: true });
    }
  },

  async executePrefix(message, args) {
    if (!hasPermission(message.member))
      return message.reply("❌ You don't have permission to unban members.");

    const userId = args[0];
    if (!userId) return message.reply("❌ Please provide a user ID. Usage: `$unban 123456789 reason`");

    const reason = args.slice(1).join(" ") || "No reason provided";
    try {
      const ban = await message.guild.bans.fetch(userId);
      await message.guild.members.unban(userId, reason);
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("✅ Member Unbanned")
        .setDescription(`**${ban.user.tag}** has been unbanned.\n**Reason:** ${reason}`);
      await message.reply({ embeds: [embed] });
    } catch {
      await message.reply("❌ Could not find a ban for that user ID.");
    }
  },
};
