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
  name: "removemodrole",
  prefixOnly: true,
  accessLevel: "admin",
  description: "Mod role setup command.",
  usage: "$removemodrole @role1, @role2",

  async executePrefix(message, args) {
    if (!message.guild) return;
    if (!canManageRoles(message.member)) {
      const reply = await message.reply("❌ Only server admins/managers can remove mod roles.").catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => null), 7000);
      return;
    }

    const roleIds = parseRoleIds(message, args);
    if (!roleIds.length) {
      const reply = await message.reply("❌ Please mention one or more roles. Usage: `$removemodrole @role1, @role2`").catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => null), 9000);
      return;
    }

    const config = await removeRoleIds(message.guild, "mod", roleIds, message.author.id);

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("✅ Mod Roles Removed")
      .setDescription(formatRoleList(message.guild, config.modRoleIds))
      .setFooter({ text: "Legendary Bot role access updated" })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
