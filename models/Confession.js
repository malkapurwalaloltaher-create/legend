const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const confessionSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },

    channelId: {
      type: String,
      required: true,
    },

    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    username: {
      type: String,
      required: true,
    },

    text: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["confession", "reply"],
      default: "confession",
      index: true,
    },

    confessionNumber: {
      type: Number,
      default: null,
      index: true,
    },

    parentMessageId: {
      type: String,
      default: null,
      index: true,
    },

    parentConfessionNumber: {
      type: Number,
      default: null,
    },

    reactions: {
      love: { type: Number, default: 0 },
      laugh: { type: Number, default: 0 },
      cry: { type: Number, default: 0 },
      eyes: { type: Number, default: 0 },
    },

    reactionUsers: {
      love: { type: [String], default: [] },
      laugh: { type: [String], default: [] },
      cry: { type: [String], default: [] },
      eyes: { type: [String], default: [] },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = serverDb.models.Confession || serverDb.model("Confession", confessionSchema);
