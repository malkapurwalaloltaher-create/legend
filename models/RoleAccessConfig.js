const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const roleAccessConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    guildName: { type: String, default: "" },

    staffRoleIds: { type: [String], default: [] },
    staffRoleNames: { type: [String], default: [] },

    modRoleIds: { type: [String], default: [] },
    modRoleNames: { type: [String], default: [] },

    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports =
  serverDb.models.RoleAccessConfig ||
  serverDb.model("RoleAccessConfig", roleAccessConfigSchema);
