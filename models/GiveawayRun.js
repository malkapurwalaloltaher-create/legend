const mongoose = require("mongoose");

const giveawayRunSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true
    },
    templateToken: {
      type: String,
      required: true,
      index: true
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
      required: true
    },
    channelId: {
      type: String,
      required: true
    },
    messageId: {
      type: String,
      required: true
    },
    statusMessageId: {
      type: String,
      default: null
    },
    hostUserId: {
      type: String,
      default: ""
    },
    hostDisplay: {
      type: String,
      default: ""
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
    customEndingMessage1: {
      type: String,
      default: ""
    },
    customEndingMessage2: {
      type: String,
      default: ""
    },
    customWinnerAnnouncement: {
      type: String,
      default: ""
    },
    logChannelId: {
      type: String,
      default: ""
    },
    claimTimeoutMs: {
      type: Number,
      default: 12 * 60 * 60 * 1000
    },
    claimDeadline: {
      type: Number,
      default: 0
    },
    winnerClaimed: {
      type: Boolean,
      default: false
    },
    participants: {
      type: [String],
      default: []
    },
    joinedUserIds: {
      type: [String],
      default: []
    },
    blockedUsers: {
      type: [String],
      default: []
    },
    winnerIds: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ["running", "ended", "cancelled"],
      default: "running",
      index: true
    },
    isPaused: {
      type: Boolean,
      default: false
    },
    pausedAt: {
      type: Number,
      default: 0
    },
    startedAt: {
      type: Number,
      required: true
    },
    endsAt: {
      type: Number,
      required: true
    },
    warning1Sent: {
      type: Boolean,
      default: false
    },
    warning2Sent: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.models.GiveawayRun || mongoose.model("GiveawayRun", giveawayRunSchema);
