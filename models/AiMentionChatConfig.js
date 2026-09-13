const mongoose = require("mongoose");
const {
  connectAllMongoDatabases,
  getFallbackModel,
  findOneWithFallback,
} = require("../database/connections");

connectAllMongoDatabases();

const roleLimitSchema = new mongoose.Schema(
  {
    roleId: { type: String, required: true },
    roleName: { type: String, default: "" },
    dailyLimit: { type: Number, default: 20, min: 0, max: 10000 },
    unlimited: { type: Boolean, default: false },
  },
  { _id: false }
);

const aiMentionChatConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    guildName: { type: String, default: "" },

    enabled: { type: Boolean, default: false },
    preferredProvider: {
      type: String,
      enum: ["auto", "groq", "openrouter", "gemini", "local"],
      default: "auto",
    },

    personality: {
      type: String,
      enum: ["friendly", "funny", "helpful", "savage-lite", "formal"],
      default: "friendly",
    },

    botMode: {
      type: String,
      enum: ["auto", "chat", "helper", "moderator", "fun", "study"],
      default: "auto",
    },

    customSystemPrompt: {
      type: String,
      default: "You are Legendary Bot, a friendly Discord bot. Be helpful, fun, short, and safe. Keep replies suitable for a Discord community.",
    },

    replyOnlyOnMention: { type: Boolean, default: true },
    saveMemory: { type: Boolean, default: true },
    memoryLimit: { type: Number, default: 6, min: 0, max: 20 },

    cooldownSeconds: { type: Number, default: 2, min: 0, max: 3600 },
    maxReplyChars: { type: Number, default: 500, min: 50, max: 1900 },

    sessionIdleMinutes: { type: Number, default: 5, min: 1, max: 1440 },
    stopCommand: { type: String, default: "$stop" },
    appendStopHint: { type: Boolean, default: true },
    stopHintText: { type: String, default: "If you want to close AI chat, write $stop." },
    autoDetectMode: { type: Boolean, default: true },

    defaultDailyLimit: { type: Number, default: 20, min: 0, max: 10000 },
    maxSessionMessages: { type: Number, default: 40, min: 1, max: 500 },
    roleLimits: { type: [roleLimitSchema], default: [] },
    unlimitedRoleIds: { type: [String], default: [] },

    allowedMode: {
      type: String,
      enum: ["all", "allowed", "ignored"],
      default: "all",
    },

    allowedChannelIds: { type: [String], default: [] },
    ignoredChannelIds: { type: [String], default: [] },

    mentionReplyMode: {
      type: String,
      enum: ["reply", "send"],
      default: "reply",
    },

    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("AiMentionChatConfig", aiMentionChatConfigSchema, "ai");
const AiMentionChatConfigModel = fallbackPack.primaryModel;

AiMentionChatConfigModel.mainFallbackModel = fallbackPack.mainModel;
AiMentionChatConfigModel.findOneWithMainFallback = (query = {}, projection = null, options = {}) =>
  findOneWithFallback(fallbackPack, query, projection, options);

module.exports = AiMentionChatConfigModel;
