const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { hasPermission } = require("../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Remove timeout from a member (Admin/Staff only)")
    .addUserOption((opt) => opt.setName("user").setDescription("The user to unmute").setRequired(true)),

  async execute(interaction) {
    if (!hasPermission(interaction.member))
      return interaction.reply({ content: "❌ You don't have permission to unmute members.", ephemeral: true });

    const target = interaction.options.getMember("user");
    if (!target) return interaction.reply({ content: "❌ User not found.", ephemeral: true });

    await target.timeout(null);
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("🔊 Member Unmuted")
      .setDescription(`**${target.user.tag}** has been unmuted.`);
    await interaction.reply({ embeds: [embed] });
  },

  async executePrefix(message) {
    if (!hasPermission(message.member))
      return message.reply("❌ You don't have permission to unmute members.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Please mention a user. Usage: `$unmute @user`");

    await target.timeout(null);
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("🔊 Member Unmuted")
      .setDescription(`**${target.user.tag}** has been unmuted.`);
    await message.reply({ embeds: [embed] });
  },
};
