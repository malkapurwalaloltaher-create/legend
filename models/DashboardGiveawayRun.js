const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const giveawayEntrySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    username: { type: String, default: "" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const dashboardGiveawayRunSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, index: true },
    messageId: { type: String, default: "", index: true },
    hostId: { type: String, default: "" },
    hostTag: { type: String, default: "" },
    prize: { type: String, required: true },
    description: { type: String, default: "Click Join to enter!" },
    winnersCount: { type: Number, default: 1, min: 1, max: 25 },
    endsAt: { type: Date, required: true, index: true },
    status: { type: String, enum: ["running", "ended", "cancelled"], default: "running", index: true },
    entries: { type: [giveawayEntrySchema], default: [] },
    winnerIds: { type: [String], default: [] },
    winnerTags: { type: [String], default: [] },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dashboardGiveawayRunSchema.index({ guildId: 1, messageId: 1 });

module.exports =
  serverDb.models.DashboardGiveawayRun ||
  serverDb.model("DashboardGiveawayRun", dashboardGiveawayRunSchema);
