const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const loopConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },

    yap: {
      channelId: { type: String, default: null },
      intervalMs: { type: Number, default: 1800000 },
      active: { type: Boolean, default: false },
      lastSentAt: { type: Date, default: null },
      lastSource: { type: String, default: "none" },
      lastMessage: { type: String, default: "" },
    },

    rumors: {
      channelId: { type: String, default: null },
      intervalMs: { type: Number, default: 3600000 },
      active: { type: Boolean, default: false },
      lastSentAt: { type: Date, default: null },
      lastSource: { type: String, default: "none" },
      lastMessage: { type: String, default: "" },
    },

    confessChannelId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = serverDb.models.LoopConfig || serverDb.model("LoopConfig", loopConfigSchema);
