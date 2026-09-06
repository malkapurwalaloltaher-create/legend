const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { removeRoleIds, formatRoleList } = require("../utils/roleAccess");

function canManageRoles(member) {
  return Boolean(
    member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

function parseRoleIds(message, args) {
  const ids = new Set();

  for (const role of message.mentions.roles.values()) {
    ids.add(role.id);
  }

  const text = args.join(" ");
  const rawIds = text.match(/\d{16,25}/g) || [];
  for (const id of rawIds) ids.add(id);

  return [...ids];
}

module.exports = {
  name: "removestaffrole",
  prefixOnly: true,
  accessLevel: "admin",
  description: "Staff role setup command.",
  usage: "$removestaffrole @role1, @role2",

  async executePrefix(message, args) {
    if (!message.guild) return;
    if (!canManageRoles(message.member)) {
      const reply = await message.reply("❌ Only server admins/managers can remove staff roles.").catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => null), 7000);
      return;
    }

    const roleIds = parseRoleIds(message, args);
    if (!roleIds.length) {
      const reply = await message.reply("❌ Please mention one or more roles. Usage: `$removestaffrole @role1, @role2`").catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => null), 9000);
      return;
    }

    const config = await removeRoleIds(message.guild, "staff", roleIds, message.author.id);

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("✅ Staff Roles Removed")
      .setDescription(formatRoleList(message.guild, config.staffRoleIds))
      .setFooter({ text: "Legendary Bot role access updated" })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
