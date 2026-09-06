const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const ModerationConfig = require("../models/ModerationConfig");
const ModerationCase = require("../models/ModerationCase");
const ModerationWarning = require("../models/ModerationWarning");
const ModerationNote = require("../models/ModerationNote");
const ModerationVcBan = require("../models/ModerationVcBan");
const { hasPermission, parseDuration } = require("../utils");

function cleanReason(reason) {
  return String(reason || "No reason provided").trim().slice(0, 900) || "No reason provided";
}

function isStaff(member) {
  return !!member && hasPermission(member);
}

function requireStaffInteraction(interaction) {
  if (!isStaff(interaction.member)) {
    interaction.reply({ content: "❌ Admin/Staff only.", ephemeral: true }).catch(() => null);
    return false;
  }
  return true;
}

function requireStaffMessage(message) {
  if (!isStaff(message.member)) {
    message.reply("❌ Admin/Staff only.").catch(() => null);
    return false;
  }
  return true;
}

function canTarget(actorMember, targetMember, action = "moderate") {
  if (!targetMember) return { ok: false, reason: "User not found in this server." };
  if (targetMember.id === targetMember.guild.ownerId) return { ok: false, reason: "You cannot target the server owner." };
  if (actorMember && targetMember.id === actorMember.id) return { ok: false, reason: "You cannot target yourself with this action." };
  if (actorMember && !actorMember.permissions.has(PermissionFlagsBits.Administrator)) {
    if (targetMember.roles.highest.position >= actorMember.roles.highest.position) {
      return { ok: false, reason: "That member has an equal or higher role than you." };
    }
  }
  const botMember = targetMember.guild.members.me;
  if (botMember && targetMember.roles.highest.position >= botMember.roles.highest.position) {
    return { ok: false, reason: `I cannot ${action} that member because their role is higher than mine.` };
  }
  return { ok: true };
}

async function getOrCreateConfig(guildId) {
  let config = await ModerationConfig.findOne({ guildId });
  if (!config) config = await ModerationConfig.create({ guildId });
  return config;
}

async function nextCaseId(guildId) {
  const latest = await ModerationCase.findOne({ guildId }).sort({ caseId: -1 });
  return latest ? Number(latest.caseId || 0) + 1 : 1;
}

async function createCase(guild, payload) {
  const caseId = await nextCaseId(guild.id);
  const doc = await ModerationCase.create({ guildId: guild.id, caseId, ...payload });
  await sendModLog(guild, doc).catch(() => null);
  return doc;
}

async function sendModLog(guild, caseDoc) {
  const config = await ModerationConfig.findOne({ guildId: guild.id });
  if (!config?.logChannelId) return;
  const channel = await guild.client.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel || channel.guildId !== guild.id) return;
  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(`🛡️ Moderation Case #${caseDoc.caseId}`)
    .addFields(
      { name: "Action", value: String(caseDoc.action || "Unknown"), inline: true },
      { name: "Target", value: caseDoc.targetId ? `<@${caseDoc.targetId}>` : "N/A", inline: true },
      { name: "Moderator", value: caseDoc.moderatorId ? `<@${caseDoc.moderatorId}>` : caseDoc.moderatorTag || "System", inline: true },
      { name: "Reason", value: String(caseDoc.reason || "No reason provided").slice(0, 1000) }
    )
    .setTimestamp(caseDoc.createdAt || new Date());
  await channel.send({ embeds: [embed] }).catch(() => null);
}

function getInteractionTargetMember(interaction) {
  return interaction.options.getMember("user");
}

function getInteractionTargetUser(interaction) {
  return interaction.options.getUser("user");
}

function getMessageTargetMember(message) {
  return message.mentions.members.first();
}

function parseUserId(input) {
  return String(input || "").trim().replace(/[<@!>]/g, "");
}

async function fetchMemberByInput(guild, input) {
  const id = parseUserId(input);
  if (!id) return null;
  return guild.members.fetch(id).catch(() => null);
}

function makeBasicEmbed(title, description, color = 0x8b5cf6) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}

function parseDurationToMs(input, fallbackMs = 10 * 60 * 1000) {
  if (!input) return fallbackMs;
  const parsed = parseDuration(String(input));
  return parsed || fallbackMs;
}

module.exports = {
  cleanReason,
  isStaff,
  requireStaffInteraction,
  requireStaffMessage,
  canTarget,
  getOrCreateConfig,
  createCase,
  sendModLog,
  getInteractionTargetMember,
  getInteractionTargetUser,
  getMessageTargetMember,
  parseUserId,
  fetchMemberByInput,
  makeBasicEmbed,
  parseDurationToMs,
  ModerationConfig,
  ModerationCase,
  ModerationWarning,
  ModerationNote,
  ModerationVcBan,
  PermissionFlagsBits,
  ChannelType,
};
