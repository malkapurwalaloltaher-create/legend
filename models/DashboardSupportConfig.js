const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { customerServerDb } = connectAllMongoDatabases();

const supportUserSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" },
    username: { type: String, default: "" },
    discordId: { type: String, default: "" },
  },
  { _id: false }
);

const dashboardSupportConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    guildName: { type: String, default: "" },
    supportTitle: { type: String, default: "Need help unlocking Premium?" },
    supportDescription: {
      type: String,
      default:
        "Contact support to unlock this module for your server. You can also DM a support member.",
    },
    supportInviteUrl: { type: String, default: "" },
    supportButtonText: { type: String, default: "Click here to contact support" },
    supportFooterNote: {
      type: String,
      default: "Tell support which server and module you want to unlock.",
    },
    supportUsers: { type: [supportUserSchema], default: [] },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("DashboardSupportConfig", dashboardSupportConfigSchema, "customerServer");
const DashboardSupportConfigModel = fallbackPack.primaryModel;

DashboardSupportConfigModel.mainFallbackModel = fallbackPack.mainModel;
DashboardSupportConfigModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardSupportConfigModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardSupportConfigModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardSupportConfigModel;
