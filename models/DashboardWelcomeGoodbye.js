const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardWelcomeGoodbyeSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    welcomeEnabled: {
      type: Boolean,
      default: false,
    },

    welcomeEmbedEnabled: {
      type: Boolean,
      default: true,
    },

    welcomeChannelId: {
      type: String,
      default: "",
    },

    welcomeChannelName: {
      type: String,
      default: "",
    },

    welcomeContent: {
      type: String,
      default: "👋 Welcome {user} to **{server}**!",
    },

    welcomeEmbedTitle: {
      type: String,
      default: "👋 Welcome to {server}!",
    },

    welcomeEmbedDescription: {
      type: String,
      default: "Hey {user}, we are happy to have you here! You are member #{memberCount}.",
    },

    welcomeEmbedColor: {
      type: String,
      default: "#8b5cf6",
    },

    welcomeEmbedFooter: {
      type: String,
      default: "Enjoy your stay!",
    },

    welcomeEmbedThumbnail: {
      type: String,
      default: "",
    },

    welcomeEmbedImage: {
      type: String,
      default: "",
    },

    goodbyeEnabled: {
      type: Boolean,
      default: false,
    },

    goodbyeEmbedEnabled: {
      type: Boolean,
      default: true,
    },

    goodbyeChannelId: {
      type: String,
      default: "",
    },

    goodbyeChannelName: {
      type: String,
      default: "",
    },

    goodbyeContent: {
      type: String,
      default: "👋 {user} left **{server}**.",
    },

    goodbyeEmbedTitle: {
      type: String,
      default: "👋 Goodbye",
    },

    goodbyeEmbedDescription: {
      type: String,
      default: "{user} has left the server. We now have {memberCount} members.",
    },

    goodbyeEmbedColor: {
      type: String,
      default: "#ff6b6b",
    },

    goodbyeEmbedFooter: {
      type: String,
      default: "Hope to see you again!",
    },

    goodbyeEmbedThumbnail: {
      type: String,
      default: "",
    },

    goodbyeEmbedImage: {
      type: String,
      default: "",
    },

    saveToTemplates: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("DashboardWelcomeGoodbye", dashboardWelcomeGoodbyeSchema, "server");
const DashboardWelcomeGoodbyeModel = fallbackPack.primaryModel;

DashboardWelcomeGoodbyeModel.mainFallbackModel = fallbackPack.mainModel;
DashboardWelcomeGoodbyeModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
DashboardWelcomeGoodbyeModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
DashboardWelcomeGoodbyeModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = DashboardWelcomeGoodbyeModel;
