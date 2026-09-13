const mongoose = require("mongoose");

const dashboardEventLogSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    eventId: { type: String, default: "", index: true },
    type: { type: String, default: "info" },
    title: { type: String, default: "" },
    message: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

dashboardEventLogSchema.index({ guildId: 1, createdAt: -1 });

module.exports =
  mongoose.models.DashboardEventLog ||
  mongoose.model("DashboardEventLog", dashboardEventLogSchema);
