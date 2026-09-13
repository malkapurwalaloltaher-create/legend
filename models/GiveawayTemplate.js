const mongoose = require("mongoose");

const giveawayTemplateSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true
    },
    prize: {
      type: String,
      required: true
    },
    durationMs: {
      type: Number,
      required: true
    },
    winnerCount: {
      type: Number,
      required: true,
      default: 1
    },
    channelId: {
      type: String,
      required: true
    },
    announcementMessage: {
      type: String,
      required: true
    },
    winnerDmMessage: {
      type: String,
      required: true
    },
    participantDmMessage: {
      type: String,
      required: true
    },
    requiredRoleId: {
      type: String,
      default: ""
    },
    minAccountAgeDays: {
      type: Number,
      default: 3
    },
    staffParticipation: {
      type: Boolean,
      default: true
    },
    hostDisplay: {
      type: String,
      default: ""
    },
    createdBy: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

giveawayTemplateSchema.index({ guildId: 1, token: 1 }, { unique: true });

module.exports = mongoose.models.GiveawayTemplate || mongoose.model("GiveawayTemplate", giveawayTemplateSchema);
