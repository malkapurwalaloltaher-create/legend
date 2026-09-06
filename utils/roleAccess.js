const { PermissionFlagsBits } = require("discord.js");
const RoleAccessConfig = require("../models/RoleAccessConfig");

const CACHE_TTL_MS = 60 * 1000;

function ensureCache() {
  if (!global.__legendaryRoleAccessCache) {
    global.__legendaryRoleAccessCache = new Map();
  }

  return global.__legendaryRoleAccessCache;
}

function normalizeId(value) {
  return String(value || "").replace(/\D/g, "").trim();
}

function uniqueStrings(values) {
  return [...new Set((values || []).map((v) => String(v || "").trim()).filter(Boolean))];
}

function hasPerm(member, flag) {
  return Boolean(member?.permissions?.has?.(flag));
}

function hasAdminPerm(member) {
  return (
    hasPerm(member, PermissionFlagsBits.Administrator) ||
    hasPerm(member, "Administrator")
  );
}

function hasManageGuildPerm(member) {
  return (
    hasAdminPerm(member) ||
    hasPerm(member, PermissionFlagsBits.ManageGuild) ||
    hasPerm(member, "ManageGuild")
  );
}

function hasModPerm(member) {
  return (
    hasManageGuildPerm(member) ||
    hasPerm(member, PermissionFlagsBits.ModerateMembers) ||
    hasPerm(member, "ModerateMembers") ||
    hasPerm(member, PermissionFlagsBits.ManageMessages) ||
    hasPerm(member, "ManageMessages") ||
    hasPerm(member, PermissionFlagsBits.KickMembers) ||
    hasPerm(member, "KickMembers") ||
    hasPerm(member, PermissionFlagsBits.BanMembers) ||
    hasPerm(member, "BanMembers") ||
    hasPerm(member, PermissionFlagsBits.ManageChannels) ||
    hasPerm(member, "ManageChannels")
  );
}

function getCachedConfig(guildId) {
  const cache = ensureCache();
  const item = cache.get(String(guildId || ""));
  if (!item) return null;

  if (Date.now() - item.loadedAt > CACHE_TTL_MS) return null;

  return item.config || null;
}

async function getRoleAccessConfig(guild) {
  const guildId = typeof guild === "string" ? guild : guild?.id;
  if (!guildId) return null;

  const cached = getCachedConfig(guildId);
  if (cached) return cached;

  let config = await RoleAccessConfig.findOne({ guildId }).catch(() => null);
  if (!config) {
    config = await RoleAccessConfig.create({
      guildId,
      guildName: typeof guild === "string" ? "" : guild?.name || "",
    });
  }

  const cache = ensureCache();
  cache.set(guildId, { loadedAt: Date.now(), config });

  return config;
}

async function refreshRoleAccessCache(guild) {
  const guildId = typeof guild === "string" ? guild : guild?.id;
  if (!guildId) return null;

  const config = await RoleAccessConfig.findOne({ guildId }).catch(() => null);
  const cache = ensureCache();

  if (config) {
    cache.set(guildId, { loadedAt: Date.now(), config });
    return config;
  }

  cache.delete(guildId);
  return null;
}

function memberHasAnyRoleId(member, roleIds = []) {
  if (!member?.roles?.cache) return false;
  return uniqueStrings(roleIds).some((roleId) => member.roles.cache.has(roleId));
}

async function isStaffMember(member) {
  if (!member?.guild) return false;
  if (hasAdminPerm(member) || hasManageGuildPerm(member)) return true;

  const config = await getRoleAccessConfig(member.guild);
  return memberHasAnyRoleId(member, config?.staffRoleIds) || memberHasAnyRoleId(member, config?.modRoleIds);
}

async function isModMember(member) {
  if (!member?.guild) return false;
  if (hasModPerm(member)) return true;

  const config = await getRoleAccessConfig(member.guild);
  return memberHasAnyRoleId(member, config?.modRoleIds);
}

async function getAccessProfile(member) {
  const config = member?.guild ? await getRoleAccessConfig(member.guild) : null;

  const isAdmin = hasAdminPerm(member);
  const isManager = hasManageGuildPerm(member);
  const hasModPermissions = hasModPerm(member);
  const isConfiguredStaff = memberHasAnyRoleId(member, config?.staffRoleIds);
  const isConfiguredMod = memberHasAnyRoleId(member, config?.modRoleIds);

  const staff = Boolean(isAdmin || isManager || isConfiguredStaff || isConfiguredMod);
  const mod = Boolean(isAdmin || isManager || hasModPermissions || isConfiguredMod);

  return {
    isAdmin,
    isManager,
    hasModPermissions,
    isConfiguredStaff,
    isConfiguredMod,
    staff,
    mod,
    public: true,
  };
}

async function canUseAccess(member, level = "public") {
  const profile = await getAccessProfile(member);

  if (level === "public") return true;
  if (level === "staff") return profile.staff;
  if (level === "mod") return profile.mod;
  if (level === "admin") return profile.isAdmin || profile.isManager;

  return profile.public;
}

async function addRoleIds(guild, type, roleIds, updatedBy = "") {
  const ids = uniqueStrings(roleIds.map(normalizeId));
  const config = await getRoleAccessConfig(guild);

  const key = type === "mod" ? "modRoleIds" : "staffRoleIds";
  const nameKey = type === "mod" ? "modRoleNames" : "staffRoleNames";

  const current = uniqueStrings(config[key]);
  const merged = uniqueStrings([...current, ...ids]);

  const names = merged.map((roleId) => guild.roles.cache.get(roleId)?.name || roleId);

  config[key] = merged;
  config[nameKey] = names;
  config.guildName = guild.name;
  config.updatedBy = updatedBy;
  config.updatedAt = new Date();

  await config.save();
  await refreshRoleAccessCache(guild);

  return config;
}

async function removeRoleIds(guild, type, roleIds, updatedBy = "") {
  const ids = new Set(uniqueStrings(roleIds.map(normalizeId)));
  const config = await getRoleAccessConfig(guild);

  const key = type === "mod" ? "modRoleIds" : "staffRoleIds";
  const nameKey = type === "mod" ? "modRoleNames" : "staffRoleNames";

  const remaining = uniqueStrings(config[key]).filter((roleId) => !ids.has(roleId));
  const names = remaining.map((roleId) => guild.roles.cache.get(roleId)?.name || roleId);

  config[key] = remaining;
  config[nameKey] = names;
  config.guildName = guild.name;
  config.updatedBy = updatedBy;
  config.updatedAt = new Date();

  await config.save();
  await refreshRoleAccessCache(guild);

  return config;
}

function formatRoleList(guild, roleIds = []) {
  const ids = uniqueStrings(roleIds);
  if (!ids.length) return "None set yet.";
  return ids.map((id) => {
    const role = guild.roles.cache.get(id);
    return role ? `${role.name} \`${id}\`` : `Deleted/unknown role \`${id}\``;
  }).join("\n");
}

module.exports = {
  getRoleAccessConfig,
  refreshRoleAccessCache,
  getAccessProfile,
  canUseAccess,
  isStaffMember,
  isModMember,
  addRoleIds,
  removeRoleIds,
  formatRoleList,
  normalizeId,
};
