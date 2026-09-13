const mongoose = require("mongoose");

const { Schema } = mongoose;

const schema = new Schema({
  guildId: { type: String, required: true, index: true },
  enabled: { type: Boolean, default: false },
  updatedBy: { type: String, default: "dashboard" },
  notes: { type: String, default: "" },
  settings: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

schema.index({ guildId: 1 }, { unique: true });

module.exports = mongoose.models.DashboardWorkflowConfig || mongoose.model("DashboardWorkflowConfig", schema);
