const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { logsDb } = connectAllMongoDatabases();

const dashboardLoginLogSchema = new mongoose.Schema(
  {
    username: { type: String, default: "" },
    role: { type: String, enum: ["owner", "dashboard", "unknown"], default: "unknown", index: true },
    status: { type: String, enum: ["success", "failed", "unknown"], default: "unknown", index: true },
    reason: { type: String, default: "" },
    ip: { type: String, default: "unknown" },
    userAgent: { type: String, default: "unknown" },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("DashboardLoginLog", dashboardLoginLogSchema, "logs");
const DashboardLoginLogModel = fallbackPack.primaryModel;

DashboardLoginLogModel.mainFallbackModel = fallbackPack.mainModel;
DashboardLoginLogModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardLoginLogModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardLoginLogModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardLoginLogModel;
