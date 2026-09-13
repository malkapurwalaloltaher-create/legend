const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardCustomCommandSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    trigger: { type: String, required: true, trim: true },
    response: { type: String, default: "" },
    embedEnabled: { type: Boolean, default: false },
    embedTitle: { type: String, default: "" },
    embedDescription: { type: String, default: "" },
    embedColor: { type: String, default: "#8b5cf6" },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

dashboardCustomCommandSchema.index({ guildId: 1, trigger: 1 }, { unique: true });

const fallbackPack = getFallbackModel("DashboardCustomCommand", dashboardCustomCommandSchema, "server");
const DashboardCustomCommandModel = fallbackPack.primaryModel;

DashboardCustomCommandModel.mainFallbackModel = fallbackPack.mainModel;
DashboardCustomCommandModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardCustomCommandModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardCustomCommandModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardCustomCommandModel;
