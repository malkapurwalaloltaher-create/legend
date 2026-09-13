const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardEmbedTemplateSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      default: "General",
      trim: true,
    },

    sourceModule: {
      type: String,
      default: "unknown",
      trim: true,
    },

    sourceLabel: {
      type: String,
      default: "Built from Dashboard",
      trim: true,
    },

    templateType: {
      type: String,
      default: "embed",
      trim: true,
    },

    content: {
      type: String,
      default: "",
    },

    embedTitle: {
      type: String,
      default: "",
    },

    embedDescription: {
      type: String,
      default: "",
    },

    embedColor: {
      type: String,
      default: "#8b5cf6",
    },

    embedFooter: {
      type: String,
      default: "",
    },

    embedImage: {
      type: String,
      default: "",
    },

    embedThumbnail: {
      type: String,
      default: "",
    },

    enabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("DashboardEmbedTemplate", dashboardEmbedTemplateSchema, "server");
const DashboardEmbedTemplateModel = fallbackPack.primaryModel;

DashboardEmbedTemplateModel.mainFallbackModel = fallbackPack.mainModel;
DashboardEmbedTemplateModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardEmbedTemplateModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardEmbedTemplateModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardEmbedTemplateModel;
