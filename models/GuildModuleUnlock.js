const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const guildModuleUnlockSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    guildName: { type: String, default: "" },
    moduleKey: { type: String, required: true, index: true },
    enabled: { type: Boolean, default: false },
    updatedBy: { type: String, default: "dashboard-owner" },
  },
  { timestamps: true }
);

guildModuleUnlockSchema.index({ guildId: 1, moduleKey: 1 }, { unique: true });

const fallbackPack = getFallbackModel("GuildModuleUnlock", guildModuleUnlockSchema, "server");
const GuildModuleUnlockModel = fallbackPack.primaryModel;

GuildModuleUnlockModel.mainFallbackModel = fallbackPack.mainModel;
GuildModuleUnlockModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
GuildModuleUnlockModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
GuildModuleUnlockModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = GuildModuleUnlockModel;
