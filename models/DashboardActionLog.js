const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { logsDb } = connectAllMongoDatabases();

const dashboardActionLogSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    guildName: { type: String, default: "" },

    action: { type: String, required: true, index: true },
    status: { type: String, enum: ["success", "failed"], default: "success", index: true },

    targetId: { type: String, default: "", index: true },
    targetTag: { type: String, default: "" },

    channelId: { type: String, default: "" },
    channelName: { type: String, default: "" },

    roleId: { type: String, default: "" },
    roleName: { type: String, default: "" },

    reason: { type: String, default: "" },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: "" },

    executedBy: { type: String, default: "owner-dashboard" },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("DashboardActionLog", dashboardActionLogSchema, "logs");
const DashboardActionLogModel = fallbackPack.primaryModel;

DashboardActionLogModel.mainFallbackModel = fallbackPack.mainModel;
DashboardActionLogModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardActionLogModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardActionLogModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardActionLogModel;
