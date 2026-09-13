const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const moderationConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    logChannelId: { type: String, default: "" },
    logChannelName: { type: String, default: "" },
    welcomeChannelId: { type: String, default: "" },
    welcomeChannelName: { type: String, default: "" },
    verifyChannelId: { type: String, default: "" },
    verifyChannelName: { type: String, default: "" },
    verifyRoleId: { type: String, default: "" },
    verifyRoleName: { type: String, default: "" },
    automodEnabled: { type: Boolean, default: false },
    antiLinkEnabled: { type: Boolean, default: false },
    antiSpamEnabled: { type: Boolean, default: false },
    antiRaidEnabled: { type: Boolean, default: false },
    spamMaxMessages: { type: Number, default: 5, min: 2, max: 20 },
    spamWindowSeconds: { type: Number, default: 8, min: 3, max: 60 },
    spamTimeoutMinutes: { type: Number, default: 10, min: 1, max: 40320 },
    raidJoinLimit: { type: Number, default: 8, min: 3, max: 100 },
    raidWindowSeconds: { type: Number, default: 60, min: 10, max: 600 },
    allowedLinkRoles: { type: [String], default: [] },
    protectedRoleIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = serverDb.models.ModerationConfig || serverDb.model("ModerationConfig", moderationConfigSchema);
