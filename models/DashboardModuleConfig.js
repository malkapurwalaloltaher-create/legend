const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardModuleConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    moduleKey: { type: String, required: true, index: true },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

dashboardModuleConfigSchema.index({ guildId: 1, moduleKey: 1 }, { unique: true });

const fallbackPack = getFallbackModel("DashboardModuleConfig", dashboardModuleConfigSchema, "server");
const DashboardModuleConfigModel = fallbackPack.primaryModel;

DashboardModuleConfigModel.mainFallbackModel = fallbackPack.mainModel;
DashboardModuleConfigModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardModuleConfigModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardModuleConfigModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardModuleConfigModel;
