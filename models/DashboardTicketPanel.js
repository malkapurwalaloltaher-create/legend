const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const ticketButtonSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Open Ticket" },
    emoji: { type: String, default: "🎫" },
    style: { type: String, default: "Primary" },
    categoryRef: { type: String, default: "" },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const dashboardTicketPanelSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true, default: "Support Panel" },
    channelId: { type: String, default: "" },
    channelName: { type: String, default: "" },
    content: { type: String, default: "" },
    embedEnabled: { type: Boolean, default: true },
    title: { type: String, default: "🎫 Need Help?" },
    description: { type: String, default: "Choose a button below to open the right ticket." },
    color: { type: String, default: "#8b5cf6" },
    footer: { type: String, default: "Legendary Bot Ticket System" },
    thumbnail: { type: String, default: "" },
    image: { type: String, default: "" },
    buttons: { type: [ticketButtonSchema], default: [] },
    active: { type: Boolean, default: true },
    lastMessageId: { type: String, default: "" },
  },
  { timestamps: true }
);

dashboardTicketPanelSchema.index({ guildId: 1, name: 1 });

const fallbackPack = getFallbackModel("DashboardTicketPanel", dashboardTicketPanelSchema, "server");
const DashboardTicketPanelModel = fallbackPack.primaryModel;

DashboardTicketPanelModel.mainFallbackModel = fallbackPack.mainModel;
DashboardTicketPanelModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardTicketPanelModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardTicketPanelModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardTicketPanelModel;
