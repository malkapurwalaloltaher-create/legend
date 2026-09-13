const mongoose = require("mongoose");
const {
  connectAllMongoDatabases,
  getFallbackModel,
  findOneWithFallback,
  deleteManyWithFallback,
} = require("../database/connections");

connectAllMongoDatabases();

const afkStatusSchema = new mongoose.Schema(
  {
    guildId: { type: String, index: true, required: true },
    userId: { type: String, index: true, required: true },
    username: { type: String, default: "" },
    reason: { type: String, default: "AFK" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

afkStatusSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const fallbackPack = getFallbackModel("AfkStatus", afkStatusSchema, "utility");
const AfkStatusModel = fallbackPack.primaryModel;

AfkStatusModel.mainFallbackModel = fallbackPack.mainModel;
AfkStatusModel.findOneWithMainFallback = (query = {}, projection = null, options = {}) =>
  findOneWithFallback(fallbackPack, query, projection, options);
AfkStatusModel.deleteManyWithMainFallback = (query = {}) =>
  deleteManyWithFallback(fallbackPack, query);

module.exports = AfkStatusModel;
