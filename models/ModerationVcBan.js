const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const moderationVcBanSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: "" },
    moderatorId: { type: String, default: "" },
    moderatorTag: { type: String, default: "Dashboard / System" },
    reason: { type: String, default: "No reason provided" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

moderationVcBanSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = serverDb.models.ModerationVcBan || serverDb.model("ModerationVcBan", moderationVcBanSchema);
