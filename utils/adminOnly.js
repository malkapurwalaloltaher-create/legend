const { PermissionFlagsBits } = require("discord.js");

async function ensureAdmin(interaction) {
  const member = interaction.member;

  const allowed =
    member &&
    member.permissions &&
    (
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild)
    );

  if (allowed) return true;

  await interaction.reply({
    content: "❌ This is an admin-only command.",
    ephemeral: true
  }).catch(() => null);

  return false;
}

module.exports = { ensureAdmin };
