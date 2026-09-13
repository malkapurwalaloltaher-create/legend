const mongoose = require("mongoose");
const {
  connectAllMongoDatabases,
  getFallbackModel,
  findOneWithFallback,
  findWithFallback,
  countWithFallback,
} = require("../database/connections");

connectAllMongoDatabases();

const answerPartSchema = new mongoose.Schema(
  {
    content: { type: String, default: "" },
    authorId: { type: String, default: "" },
    messageId: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    secondsSinceQuestion: { type: Number, default: 0 },
  },
  { _id: false }
);

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, default: "" },
    questionText: { type: String, default: "" },
    answer: { type: String, default: "" },
    section: { type: String, default: "" },
    score: { type: Number, default: 0 },
    flags: { type: [String], default: [] },
    aiCopySuspected: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    answeredAt: { type: Date, default: Date.now },
    secondsToAnswer: { type: Number, default: 0 },
    parts: { type: [answerPartSchema], default: [] },
  },
  { _id: false }
);

const aiResultSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "local" },
    model: { type: String, default: "local" },
    raw: { type: String, default: "" },
    summary: { type: String, default: "" },
    recommendation: { type: String, enum: ["pass", "review", "reject"], default: "review" },
    score: { type: Number, default: 0 },
    maturity: { type: Number, default: 0 },
    trust: { type: Number, default: 0 },
    activity: { type: Number, default: 0 },
    experience: { type: Number, default: 0 },
    risk: { type: Number, default: 0 },
    flags: { type: [String], default: [] },
  },
  { _id: false }
);

const aiTicketSessionSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    guildName: { type: String, default: "" },

    channelId: { type: String, required: true, unique: true, index: true },
    channelName: { type: String, default: "" },
    categoryId: { type: String, default: "" },

    typeKey: { type: String, required: true, index: true },
    typeLabel: { type: String, default: "" },

    applicantId: { type: String, default: "" },
    applicantTag: { type: String, default: "" },

    status: {
      type: String,
      enum: ["active", "completed", "passed", "auto_approved", "pending_review", "rejected", "cancelled", "timeout"],
      default: "active",
      index: true,
    },

    currentQuestionIndex: { type: Number, default: 0 },
    currentQuestionStartedAt: { type: Date, default: null },
    currentAnswerParts: { type: [answerPartSchema], default: [] },
    answers: { type: [answerSchema], default: [] },

    localScore: { type: Number, default: 0 },
    finalScore: { type: Number, default: 0 },
    finalScoreMax: { type: Number, default: 100 },
    finalResult: { type: aiResultSchema, default: () => ({}) },

    reviewChannelId: { type: String, default: "" },
    reviewMessageId: { type: String, default: "" },

    autoApprovedRoleId: { type: String, default: "" },
    autoApprovedAt: { type: Date, default: null },

    nextPingAt: { type: Date, default: null },
    pingCount: { type: Number, default: 0 },

    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("AITicketSession", aiTicketSessionSchema, "server");
const AITicketSessionModel = fallbackPack.primaryModel;

AITicketSessionModel.mainFallbackModel = fallbackPack.mainModel;
AITicketSessionModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
AITicketSessionModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
AITicketSessionModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = AITicketSessionModel;
