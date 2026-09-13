const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const dashboardGiveawayConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    notes: { type: String, default: "" },
    logChannelId: { type: String, default: "" },
    defaultDurationMinutes: { type: Number, default: 1440, min: 1, max: 525600 },
    defaultWinners: { type: Number, default: 1, min: 1, max: 25 },
    dmWinners: { type: Boolean, default: true },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports =
  serverDb.models.DashboardGiveawayConfig ||
  serverDb.model("DashboardGiveawayConfig", dashboardGiveawayConfigSchema);
