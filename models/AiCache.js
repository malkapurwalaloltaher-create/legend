const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const aiCacheSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, unique: true, index: true },
    yaps: { type: [String], default: [] },
    rumors: { type: [mongoose.Schema.Types.Mixed], default: [] },
    usedYaps: { type: [String], default: [] },
    usedRumors: { type: [String], default: [] },
    apiBlockedUntil: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = serverDb.models.AiCache || serverDb.model("AiCache", aiCacheSchema);
