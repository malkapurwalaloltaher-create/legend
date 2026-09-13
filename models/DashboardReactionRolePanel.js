const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const reactionRoleButtonSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },

    emoji: {
      type: String,
      default: "",
      trim: true,
    },

    roleId: {
      type: String,
      required: true,
    },

    roleName: {
      type: String,
      default: "",
    },

    style: {
      type: String,
      enum: ["Primary", "Secondary", "Success", "Danger"],
      default: "Secondary",
    },
  },
  { _id: false }
);

const dashboardReactionRolePanelSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },

    channelId: {
      type: String,
      required: true,
    },

    channelName: {
      type: String,
      default: "",
    },

    messageId: {
      type: String,
      default: "",
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String,
      default: "",
    },

    embedEnabled: {
      type: Boolean,
      default: true,
    },

    title: {
      type: String,
      default: "Reaction Roles",
    },

    description: {
      type: String,
      default: "Click a button below to get or remove a role.",
    },

    color: {
      type: String,
      default: "#8b5cf6",
    },

    footer: {
      type: String,
      default: "Click again to remove the role.",
    },

    image: {
      type: String,
      default: "",
    },

    thumbnail: {
      type: String,
      default: "",
    },

    buttons: {
      type: [reactionRoleButtonSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 25;
        },
        message: "Reaction role panels can have a maximum of 25 buttons.",
      },
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = serverDb.models.DashboardReactionRolePanel || serverDb.model("DashboardReactionRolePanel", dashboardReactionRolePanelSchema);
