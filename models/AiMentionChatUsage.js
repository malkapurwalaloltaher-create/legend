const mongoose = require("mongoose");
const {
  connectAllMongoDatabases,
  getFallbackModel,
  findOneWithFallback,
} = require("../database/connections");

connectAllMongoDatabases();

const aiMentionChatUsageSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    dayKey: { type: String, required: true, index: true },
    count: { type: Number, default: 0, min: 0 },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

aiMentionChatUsageSchema.index({ guildId: 1, userId: 1, dayKey: 1 }, { unique: true });

const fallbackPack = getFallbackModel("AiMentionChatUsage", aiMentionChatUsageSchema, "ai");
const AiMentionChatUsageModel = fallbackPack.primaryModel;

AiMentionChatUsageModel.mainFallbackModel = fallbackPack.mainModel;
AiMentionChatUsageModel.findOneWithMainFallback = (query = {}, projection = null, options = {}) =>
  findOneWithFallback(fallbackPack, query, projection, options);

module.exports = AiMentionChatUsageModel;
