const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardAutoMessageSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    channelName: { type: String, default: "unknown-channel" },

    name: { type: String, required: true, default: "Auto Message" },

    content: { type: String, default: "" },

    embedTitle: { type: String, default: "" },
    embedDescription: { type: String, default: "" },
    embedColor: { type: String, default: "#8b5cf6" },
    embedFooter: { type: String, default: "" },
    embedImage: { type: String, default: "" },
    embedThumbnail: { type: String, default: "" },

    intervalHours: { type: Number, default: 12 },
    active: { type: Boolean, default: true },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("DashboardAutoMessage", dashboardAutoMessageSchema, "server");
const DashboardAutoMessageModel = fallbackPack.primaryModel;

DashboardAutoMessageModel.mainFallbackModel = fallbackPack.mainModel;
DashboardAutoMessageModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardAutoMessageModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardAutoMessageModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardAutoMessageModel;
