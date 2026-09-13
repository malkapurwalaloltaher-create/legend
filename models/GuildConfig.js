const mongoose = require("mongoose");

const guildConfigSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    logChannelId: {
      type: String,
      default: ""
    },
    bonusEntryRoles: {
      type: [
        {
          roleId: String,
          entries: Number
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.GuildConfig || mongoose.model("GuildConfig", guildConfigSchema);
