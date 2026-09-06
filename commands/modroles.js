const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { getRoleAccessConfig, formatRoleList } = require("../utils/roleAccess");

function canView(member) {
  return Boolean(
    member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    member?.permissions?.has(PermissionFlagsBits.ModerateMembers)
  );
}

module.exports = {
  name: "modroles",
  prefixOnly: true,
  accessLevel: "staff",
  description: "List configured mod roles.",
  usage: "$modroles",

  async executePrefix(message) {
    if (!message.guild) return;
    if (!canView(message.member)) {
      const reply = await message.reply("❌ Staff/admin only.").catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => null), 7000);
      return;
    }

    const config = await getRoleAccessConfig(message.guild);

    const embed = new EmbedBuilder()
      .setColor(0x22d3ee)
      .setTitle("📌 Mod Roles")
      .setDescription(formatRoleList(message.guild, config.modRoleIds))
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
