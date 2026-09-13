const mongoose = require("mongoose");

const dashboardEventItemSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    type: {
      type: String,
      enum: ["custom", "festival", "server", "community"],
      default: "custom",
      index: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "announced", "started", "ended", "cancelled"],
      default: "scheduled",
      index: true,
    },
    channelId: { type: String, default: "" },
    pingMode: { type: String, enum: ["none", "everyone", "here", "role"], default: "none" },
    roleId: { type: String, default: "" },
    bannerUrl: { type: String, default: "" },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, default: null },
    repeat: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly", "yearly"],
      default: "none",
    },
    reminderMinutes: { type: Number, default: 60 },
    messageMode: {
      type: String,
      enum: ["custom", "ai", "improve"],
      default: "custom",
    },
    customMessage: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    createdById: { type: String, default: "" },
    announceCreatedSentAt: { type: Date, default: null },
    reminderSentAt: { type: Date, default: null },
    startingSentAt: { type: Date, default: null },
    endedSentAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);

dashboardEventItemSchema.index({ guildId: 1, startsAt: 1 });
dashboardEventItemSchema.index({ guildId: 1, status: 1 });

module.exports =
  mongoose.models.DashboardEventItem ||
  mongoose.model("DashboardEventItem", dashboardEventItemSchema);
