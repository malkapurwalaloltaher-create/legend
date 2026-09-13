const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardTicketCategorySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true, default: "Support" },
    emoji: { type: String, default: "🎫" },
    description: { type: String, default: "General support tickets." },
    discordCategoryId: { type: String, default: "" },
    discordCategoryName: { type: String, default: "" },
    staffRoleId: { type: String, default: "" },
    staffRoleName: { type: String, default: "" },
    logChannelId: { type: String, default: "" },
    logChannelName: { type: String, default: "" },
    transcriptChannelId: { type: String, default: "" },
    transcriptChannelName: { type: String, default: "" },
    welcomeTitle: { type: String, default: "Welcome to your ticket" },
    welcomeMessage: { type: String, default: "Thanks for opening a ticket! Please explain your issue clearly." },
    autoCloseHours: { type: Number, default: 0 },
    aiEnabled: { type: Boolean, default: false },
    transcriptEnabled: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

dashboardTicketCategorySchema.index({ guildId: 1, name: 1 });

const fallbackPack = getFallbackModel("DashboardTicketCategory", dashboardTicketCategorySchema, "server");
const DashboardTicketCategoryModel = fallbackPack.primaryModel;

DashboardTicketCategoryModel.mainFallbackModel = fallbackPack.mainModel;
DashboardTicketCategoryModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardTicketCategoryModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardTicketCategoryModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardTicketCategoryModel;
