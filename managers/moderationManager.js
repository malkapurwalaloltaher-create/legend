const ModerationConfig = require("../models/ModerationConfig");
const ModerationWarning = require("../models/ModerationWarning");
const { createCase } = require("../utils/moderationHelpers");

const spamMap = new Map();
const raidMap = new Map();

function hasAllowedRole(member, roleIds) {
  if (!member || !Array.isArray(roleIds)) return false;
  return roleIds.some((id) => member.roles.cache.has(id));
}

function hasLink(text) {
  return /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i.test(text || "");
}

async function automodWarn(message, action, reason) {
  await ModerationWarning.create({
    guildId: message.guildId,
    userId: message.author.id,
    username: message.author.username,
    moderatorId: message.client.user.id,
    moderatorTag: message.client.user.tag,
    reason,
  }).catch(() => null);

  await createCase(message.guild, {
    action,
    targetId: message.author.id,
    targetTag: message.author.tag,
    moderatorId: message.client.user.id,
    moderatorTag: message.client.user.tag,
    reason,
    metadata: { channelId: message.channelId },
  }).catch(() => null);
}

async function handleAutoModeration(message) {
  if (!message.guild || message.author.bot) return false;
  const config = await ModerationConfig.findOne({ guildId: message.guildId });
  if (!config || !config.automodEnabled) return false;
  if (hasAllowedRole(message.member, config.protectedRoleIds)) return false;

  if (config.antiLinkEnabled && hasLink(message.content) && !hasAllowedRole(message.member, config.allowedLinkRoles)) {
    await message.delete().catch(() => null);
    await message.channel.send({ content: `⚠️ ${message.author}, links are blocked in this server.` }).then((m) => setTimeout(() => m.delete().catch(() => null), 5000)).catch(() => null);
    await automodWarn(message, "ANTILINK", "Posted a blocked link.");
    return true;
  }

  if (config.antiSpamEnabled) {
    const key = `${message.guildId}:${message.author.id}`;
    const now = Date.now();
    const windowMs = Math.max(3, Number(config.spamWindowSeconds || 8)) * 1000;
    const maxMessages = Math.max(2, Number(config.spamMaxMessages || 5));
    const data = spamMap.get(key) || [];
    const fresh = data.filter((t) => now - t < windowMs);
    fresh.push(now);
    spamMap.set(key, fresh);
    if (fresh.length >= maxMessages) {
      spamMap.set(key, []);
      await message.member.timeout(Math.max(1, Number(config.spamTimeoutMinutes || 10)) * 60 * 1000, "AutoMod anti-spam").catch(() => null);
      await automodWarn(message, "ANTISPAM", `Sent ${fresh.length} messages in ${Math.round(windowMs / 1000)} seconds.`);
      await message.channel.send(`🚨 ${message.author} was timed out for spam.`).catch(() => null);
      return true;
    }
  }

  return false;
}

async function handleAntiRaidJoin(member) {
  const config = await ModerationConfig.findOne({ guildId: member.guild.id });
  if (!config || !config.automodEnabled || !config.antiRaidEnabled) return;
  const now = Date.now();
  const windowMs = Math.max(10, Number(config.raidWindowSeconds || 60)) * 1000;
  const limit = Math.max(3, Number(config.raidJoinLimit || 8));
  const list = (raidMap.get(member.guild.id) || []).filter((t) => now - t < windowMs);
  list.push(now);
  raidMap.set(member.guild.id, list);
  if (list.length >= limit) {
    await createCase(member.guild, {
      action: "ANTIRAID ALERT",
      targetId: member.id,
      targetTag: member.user.tag,
      moderatorId: member.client.user.id,
      moderatorTag: member.client.user.tag,
      reason: `${list.length} members joined within ${Math.round(windowMs / 1000)} seconds.`,
      metadata: { joinCount: list.length },
    }).catch(() => null);
  }
}

module.exports = { handleAutoModeration, handleAntiRaidJoin };
