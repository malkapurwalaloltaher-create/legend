const mongoose = require("mongoose");

const dashboardBirthdaySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, default: "" },
    displayName: { type: String, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    day: { type: Number, required: true, min: 1, max: 31 },
    channelId: { type: String, default: "" },
    roleId: { type: String, default: "" },
    customMessage: { type: String, default: "" },
    aiMessageEnabled: { type: Boolean, default: true },
    announceInServer: { type: Boolean, default: true },
    dmUser: { type: Boolean, default: true },
    lastAnnouncedYear: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
    createdById: { type: String, default: "" },
  },
  { timestamps: true }
);

dashboardBirthdaySchema.index({ guildId: 1, month: 1, day: 1 });
dashboardBirthdaySchema.index({ guildId: 1, userId: 1 });

module.exports =
  mongoose.models.DashboardBirthday ||
  mongoose.model("DashboardBirthday", dashboardBirthdaySchema);
