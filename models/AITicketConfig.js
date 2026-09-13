const mongoose = require("mongoose");
const {
  connectAllMongoDatabases,
  getFallbackModel,
  findOneWithFallback,
  findWithFallback,
  countWithFallback,
} = require("../database/connections");

connectAllMongoDatabases();

const DEFAULT_AI_TICKET_TYPES = [
  { key: "staff_application", label: "Staff Applications", enabled: true, categoryId: "", reviewChannelId: "", pingRoleId: "" },
  { key: "ban_appeal", label: "Ban Appeals", enabled: true, categoryId: "", reviewChannelId: "", pingRoleId: "" },
  { key: "warn_appeal", label: "Warn Appeals", enabled: true, categoryId: "", reviewChannelId: "", pingRoleId: "" },
  { key: "partnership", label: "Partnership", enabled: true, categoryId: "", reviewChannelId: "", pingRoleId: "" },
  { key: "support", label: "Support", enabled: true, categoryId: "", reviewChannelId: "", pingRoleId: "" },
];

function normalizeAITicketTypes(types = []) {
  const byKey = new Map();

  for (const item of Array.isArray(types) ? types : []) {
    const plain = typeof item?.toObject === "function" ? item.toObject() : item;
    if (plain?.key) byKey.set(String(plain.key), plain);
  }

  return DEFAULT_AI_TICKET_TYPES.map((base) => {
    const saved = byKey.get(base.key) || {};

    return {
      key: base.key,
      label: saved.label || base.label,
      enabled: saved.enabled !== false,
      categoryId: String(saved.categoryId || base.categoryId || "").trim(),
      reviewChannelId: String(saved.reviewChannelId || base.reviewChannelId || "").trim(),
      pingRoleId: String(saved.pingRoleId || base.pingRoleId || "").trim(),
    };
  });
}

const ticketTypeConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, default: "" },
    enabled: { type: Boolean, default: true },
    categoryId: { type: String, default: "" },
    reviewChannelId: { type: String, default: "" },
    pingRoleId: { type: String, default: "" },
  },
  { _id: false }
);

const aiTicketConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    guildName: { type: String, default: "" },

    enabled: { type: Boolean, default: true },
    strictness: { type: String, enum: ["relaxed", "normal", "strict"], default: "normal" },

    // Score can go above 100 because bonus points are possible.
    finalScoreMax: { type: Number, default: 100 },
    passScore: { type: Number, default: 100 },
    staffReviewMinScore: { type: Number, default: 75 },
    pendingPingMinutes: { type: Number, default: 30 },
    sessionTimeoutMinutes: { type: Number, default: 60 },

    // Manual answer flow.
    requireNextCommand: { type: Boolean, default: true },
    nextCommand: { type: String, default: "$next" },

    // Auto approve is available, but OFF by default for safety.
    autoApproveEnabled: { type: Boolean, default: false },
    autoApproveRoleId: { type: String, default: "" },
    autoApproveOnlyIfNoAiFlags: { type: Boolean, default: true },

    // Report/transcript delivery.
    reportWebhookUrl: { type: String, default: "" },
    saveRawAnswersAfterReport: { type: Boolean, default: true },

    // AI-copy detection.
    aiCopyDetectionEnabled: { type: Boolean, default: true },
    aiCopyMinChars: { type: Number, default: 350 },
    aiCopyFastSeconds: { type: Number, default: 45 },
    aiCopyScoreCap: { type: Number, default: 7 },

    aiEnabled: { type: Boolean, default: true },
    preferredProvider: { type: String, enum: ["auto", "groq", "openrouter", "gemini", "local"], default: "auto" },

    types: {
      type: [ticketTypeConfigSchema],
      default: () => normalizeAITicketTypes([]),
    },

    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("AITicketConfig", aiTicketConfigSchema, "server");
const AITicketConfigModel = fallbackPack.primaryModel;

AITicketConfigModel.DEFAULT_AI_TICKET_TYPES = DEFAULT_AI_TICKET_TYPES;
AITicketConfigModel.normalizeTypes = normalizeAITicketTypes;

AITicketConfigModel.mainFallbackModel = fallbackPack.mainModel;
AITicketConfigModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
AITicketConfigModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
AITicketConfigModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = AITicketConfigModel;
