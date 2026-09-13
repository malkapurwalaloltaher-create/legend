const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const moderationCaseSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    caseId: { type: Number, required: true, index: true },
    action: { type: String, required: true, index: true },
    targetId: { type: String, default: "", index: true },
    targetTag: { type: String, default: "" },
    moderatorId: { type: String, default: "" },
    moderatorTag: { type: String, default: "Dashboard / System" },
    reason: { type: String, default: "No reason provided" },
    durationMs: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

moderationCaseSchema.index({ guildId: 1, caseId: 1 }, { unique: true });

module.exports = serverDb.models.ModerationCase || serverDb.model("ModerationCase", moderationCaseSchema);
