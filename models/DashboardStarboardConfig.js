const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardStarboardConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    starboardChannelId: { type: String, default: "" },
    starboardChannelName: { type: String, default: "" },
    emoji: { type: String, default: "⭐" },
    threshold: { type: Number, default: 3, min: 1 },
    postedMessageIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("DashboardStarboardConfig", dashboardStarboardConfigSchema, "server");
const DashboardStarboardConfigModel = fallbackPack.primaryModel;

DashboardStarboardConfigModel.mainFallbackModel = fallbackPack.mainModel;
DashboardStarboardConfigModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardStarboardConfigModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardStarboardConfigModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardStarboardConfigModel;
