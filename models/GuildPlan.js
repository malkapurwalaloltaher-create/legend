const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const guildPlanSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    guildName: {
      type: String,
      default: "",
    },

    plan: {
      type: String,
      enum: ["free", "premium"],
      default: "free",
      index: true,
    },

    premiumEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },

    premiumSince: {
      type: Date,
      default: null,
    },

    premiumUpdatedAt: {
      type: Date,
      default: null,
    },

    premiumUpdatedBy: {
      type: String,
      default: "dashboard-owner",
    },

    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("GuildPlan", guildPlanSchema, "server");
const GuildPlanModel = fallbackPack.primaryModel;

GuildPlanModel.mainFallbackModel = fallbackPack.mainModel;
GuildPlanModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
GuildPlanModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
GuildPlanModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = GuildPlanModel;
