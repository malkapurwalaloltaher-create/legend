const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardSportsConfigSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    footballChannelId: {
      type: String,
      default: "",
    },

    footballChannelName: {
      type: String,
      default: "",
    },

    cricketChannelId: {
      type: String,
      default: "",
    },

    cricketChannelName: {
      type: String,
      default: "",
    },

    goalAlertChannelId: {
      type: String,
      default: "",
    },

    goalAlertChannelName: {
      type: String,
      default: "",
    },

    footballEnabled: {
      type: Boolean,
      default: false,
    },

    cricketEnabled: {
      type: Boolean,
      default: false,
    },

    goalAlertsEnabled: {
      type: Boolean,
      default: false,
    },

    updateMinutes: {
      type: Number,
      default: 5,
    },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("DashboardSportsConfig", dashboardSportsConfigSchema, "server");
const DashboardSportsConfigModel = fallbackPack.primaryModel;

DashboardSportsConfigModel.mainFallbackModel = fallbackPack.mainModel;
DashboardSportsConfigModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardSportsConfigModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardSportsConfigModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardSportsConfigModel;
