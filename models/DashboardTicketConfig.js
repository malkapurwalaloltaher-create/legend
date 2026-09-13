const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardTicketConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    panelChannelId: { type: String, default: "" },
    panelChannelName: { type: String, default: "" },
    categoryId: { type: String, default: "" },
    supportRoleId: { type: String, default: "" },
    supportRoleName: { type: String, default: "" },
    panelTitle: { type: String, default: "🎫 Open a Ticket" },
    panelDescription: { type: String, default: "Click the button below to open a support ticket." },
    panelColor: { type: String, default: "#8b5cf6" },
    buttonLabel: { type: String, default: "Open Ticket" },
    buttonEmoji: { type: String, default: "🎫" },
    buttonStyle: { type: String, default: "Primary" },
    panelFooter: { type: String, default: "Legendary Bot Ticket System" },
    panelThumbnail: { type: String, default: "" },
    panelImage: { type: String, default: "" },
    ticketWelcomeTitle: { type: String, default: "Welcome to your ticket" },
    ticketWelcomeMessage: { type: String, default: "Thanks for opening a ticket! Please explain your issue clearly and staff will help you soon." },
    ticketNameFormat: { type: String, default: "ticket-{username}" },
    logChannelId: { type: String, default: "" },
    logChannelName: { type: String, default: "" },
    transcriptEnabled: { type: Boolean, default: true },
    dmUserOnOpen: { type: Boolean, default: true },
    dmUserOnClose: { type: Boolean, default: true },
    staffPingOnOpen: { type: Boolean, default: true },
    aiPrecheckEnabled: { type: Boolean, default: false },
    autoCloseHours: { type: Number, default: 0 },
    maxOpenTicketsPerUser: { type: Number, default: 1 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("DashboardTicketConfig", dashboardTicketConfigSchema, "server");
const DashboardTicketConfigModel = fallbackPack.primaryModel;

DashboardTicketConfigModel.mainFallbackModel = fallbackPack.mainModel;
DashboardTicketConfigModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardTicketConfigModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardTicketConfigModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardTicketConfigModel;
