const { PermissionFlagsBits } = require("discord.js");

const STAFF_ROLES = ["Legend Server Staff", "Legend Moderator"];

function getCachedRoleConfig(guildId) {
  const cache = global.__legendaryRoleAccessCache;
  if (!cache) return null;
  const item = cache.get(String(guildId || ""));
  return item?.config || null;
}

function hasAnyConfiguredRole(member, roleIds = []) {
  if (!member?.roles?.cache) return false;
  return (roleIds || []).some((roleId) => member.roles.cache.has(String(roleId)));
}

function hasPermission(member) {
  if (!member) return false;

  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (member.permissions.has(PermissionFlagsBits.ModerateMembers)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  if (member.permissions.has(PermissionFlagsBits.KickMembers)) return true;
  if (member.permissions.has(PermissionFlagsBits.BanMembers)) return true;

  const config = getCachedRoleConfig(member.guild?.id);
  if (config) {
    if (hasAnyConfiguredRole(member, config.staffRoleIds)) return true;
    if (hasAnyConfiguredRole(member, config.modRoleIds)) return true;
  }

  return member.roles.cache.some((role) => STAFF_ROLES.includes(role.name));
}

function parseDuration(str) {
  const match = String(str || "").match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

module.exports = { hasPermission, parseDuration };
