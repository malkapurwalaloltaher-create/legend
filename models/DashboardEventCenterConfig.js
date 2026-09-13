const mongoose = require("mongoose");

const dashboardEventCenterConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    defaultChannelId: { type: String, default: "" },
    defaultPingMode: { type: String, default: "none" },
    defaultRoleId: { type: String, default: "" },
    birthdayChannelId: { type: String, default: "" },
    festivalChannelId: { type: String, default: "" },
    aiAnnouncementsEnabled: { type: Boolean, default: false },
    birthdayAnnouncementsEnabled: { type: Boolean, default: true },
    festivalAnnouncementsEnabled: { type: Boolean, default: false },
    remindersEnabled: { type: Boolean, default: true },
    timezone: { type: String, default: "Asia/Dubai" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.DashboardEventCenterConfig ||
  mongoose.model("DashboardEventCenterConfig", dashboardEventCenterConfigSchema);
