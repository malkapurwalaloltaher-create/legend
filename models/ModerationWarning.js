const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { logsDb } = connectAllMongoDatabases();

const moderationWarningSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: "" },
    moderatorId: { type: String, default: "" },
    moderatorTag: { type: String, default: "Dashboard / System" },
    reason: { type: String, default: "No reason provided" },
    caseId: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = logsDb.models.ModerationWarning || logsDb.model("ModerationWarning", moderationWarningSchema);
