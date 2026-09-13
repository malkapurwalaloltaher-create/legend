const mongoose = require("mongoose");
const {
  connectAllMongoDatabases,
  getFallbackModel,
  findWithFallback,
  countWithFallback,
} = require("../database/connections");

connectAllMongoDatabases();

const commandCenterLogSchema = new mongoose.Schema(
  {
    guildId: { type: String, index: true, default: "" },
    guildName: { type: String, default: "" },
    channelId: { type: String, index: true, default: "" },
    channelName: { type: String, default: "" },
    action: { type: String, index: true, default: "unknown" },
    actorId: { type: String, default: "" },
    actorName: { type: String, default: "" },
    targetId: { type: String, default: "" },
    targetName: { type: String, default: "" },
    messageId: { type: String, default: "" },
    status: { type: String, enum: ["success", "error"], default: "success" },
    reason: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("CommandCenterLog", commandCenterLogSchema, "logs");
const CommandCenterLogModel = fallbackPack.primaryModel;

CommandCenterLogModel.mainFallbackModel = fallbackPack.mainModel;
CommandCenterLogModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
CommandCenterLogModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = CommandCenterLogModel;
