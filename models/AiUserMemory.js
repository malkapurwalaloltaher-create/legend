const mongoose = require("mongoose");
const {
  connectAllMongoDatabases,
  getFallbackModel,
  findOneWithFallback,
} = require("../database/connections");

connectAllMongoDatabases();

const aiUserMemoryMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, default: "" },
    channelId: { type: String, default: "" },
    channelName: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiUserMemorySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: "" },
    displayName: { type: String, default: "" },
    summary: { type: String, default: "" },
    facts: { type: [String], default: [] },
    messages: { type: [aiUserMemoryMessageSchema], default: [] },
    lastUsedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

aiUserMemorySchema.index({ guildId: 1, userId: 1 }, { unique: true });

const fallbackPack = getFallbackModel("AiUserMemory", aiUserMemorySchema, "ai");
const AiUserMemoryModel = fallbackPack.primaryModel;

AiUserMemoryModel.mainFallbackModel = fallbackPack.mainModel;
AiUserMemoryModel.findOneWithMainFallback = (query = {}, projection = null, options = {}) =>
  findOneWithFallback(fallbackPack, query, projection, options);

module.exports = AiUserMemoryModel;
