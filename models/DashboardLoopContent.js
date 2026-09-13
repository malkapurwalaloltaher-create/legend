const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardLoopContentSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["yap", "rumor"],
      required: true,
      index: true,
    },

    sourceType: {
      type: String,
      enum: ["custom", "fallback"],
      required: true,
      index: true,
    },

    text: {
      type: String,
      required: true,
    },


    enabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = serverDb.models.DashboardLoopContent || serverDb.model("DashboardLoopContent", dashboardLoopContentSchema);
