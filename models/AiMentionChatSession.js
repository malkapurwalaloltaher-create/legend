const mongoose = require("mongoose");
const {
  connectAllMongoDatabases,
  getFallbackModel,
  findOneWithFallback,
} = require("../database/connections");

connectAllMongoDatabases();

const aiMentionChatSessionSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    active: { type: Boolean, default: true, index: true },
    startedAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

aiMentionChatSessionSchema.index({ guildId: 1, channelId: 1, userId: 1 }, { unique: true });

const fallbackPack = getFallbackModel("AiMentionChatSession", aiMentionChatSessionSchema, "ai");
const AiMentionChatSessionModel = fallbackPack.primaryModel;

AiMentionChatSessionModel.mainFallbackModel = fallbackPack.mainModel;
AiMentionChatSessionModel.findOneWithMainFallback = (query = {}, projection = null, options = {}) =>
  findOneWithFallback(fallbackPack, query, projection, options);

module.exports = AiMentionChatSessionModel;
