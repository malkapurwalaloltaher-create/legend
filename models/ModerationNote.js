const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { logsDb } = connectAllMongoDatabases();

const moderationNoteSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: "" },
    moderatorId: { type: String, default: "" },
    moderatorTag: { type: String, default: "Dashboard / System" },
    text: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = logsDb.models.ModerationNote || logsDb.model("ModerationNote", moderationNoteSchema);
