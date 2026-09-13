const mongoose = require("mongoose");
const {
  connectAllMongoDatabases,
  getFallbackModel,
  findOneWithFallback,
} = require("../database/connections");

connectAllMongoDatabases();

const aiMentionChatMemorySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    messages: {
      type: [
        {
          role: { type: String, enum: ["user", "assistant"], required: true },
          content: { type: String, default: "" },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    lastUsedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

aiMentionChatMemorySchema.index({ guildId: 1, channelId: 1, userId: 1 }, { unique: true });

const fallbackPack = getFallbackModel("AiMentionChatMemory", aiMentionChatMemorySchema, "ai");
const AiMentionChatMemoryModel = fallbackPack.primaryModel;

AiMentionChatMemoryModel.mainFallbackModel = fallbackPack.mainModel;
AiMentionChatMemoryModel.findOneWithMainFallback = (query = {}, projection = null, options = {}) =>
  findOneWithFallback(fallbackPack, query, projection, options);

module.exports = AiMentionChatMemoryModel;
