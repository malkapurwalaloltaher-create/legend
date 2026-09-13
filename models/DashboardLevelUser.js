const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardLevelUserSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    username: {
      type: String,
      default: "",
    },

    xp: {
      type: Number,
      default: 0,
    },

    level: {
      type: Number,
      default: 0,
    },

    lastXpAt: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

dashboardLevelUserSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = serverDb.models.DashboardLevelUser || serverDb.model("DashboardLevelUser", dashboardLevelUserSchema);
