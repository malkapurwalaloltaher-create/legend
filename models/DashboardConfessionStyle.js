const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardConfessionStyleSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    embedTitle: {
      type: String,
      default: "confession #{number}",
    },

    embedColor: {
      type: String,
      default: "#8b5cf6",
    },

    embedFooter: {
      type: String,
      default: "💌 leave your own confession with /confess!",
    },

    embedThumbnail: {
      type: String,
      default: "",
    },

    embedImage: {
      type: String,
      default: "",
    },

    anonymousLabel: {
      type: String,
      default: "new confession!",
    },

    replyButtonLabel: {
      type: String,
      default: "Reply",
    },

    reactionButtonLabel: {
      type: String,
      default: "React",
    },

    showConfessionNumber: {
      type: Boolean,
      default: true,
    },

    saveToTemplates: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("DashboardConfessionStyle", dashboardConfessionStyleSchema, "server");
const DashboardConfessionStyleModel = fallbackPack.primaryModel;

DashboardConfessionStyleModel.mainFallbackModel = fallbackPack.mainModel;
DashboardConfessionStyleModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardConfessionStyleModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardConfessionStyleModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardConfessionStyleModel;
