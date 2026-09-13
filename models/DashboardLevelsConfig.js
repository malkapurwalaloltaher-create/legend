const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");
const { serverDb } = connectAllMongoDatabases();

const levelRewardSchema = new mongoose.Schema(
  {
    level: {
      type: Number,
      required: true,
      min: 1,
    },

    roleId: {
      type: String,
      required: true,
    },

    roleName: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const levelIgnoredChannelSchema = new mongoose.Schema(
  {
    channelId: {
      type: String,
      required: true,
    },

    channelName: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const levelNoXpRoleSchema = new mongoose.Schema(
  {
    roleId: {
      type: String,
      required: true,
    },

    roleName: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const levelMultiplierRoleSchema = new mongoose.Schema(
  {
    roleId: {
      type: String,
      required: true,
    },

    roleName: {
      type: String,
      default: "",
    },

    multiplier: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
  },
  { _id: false }
);

const dashboardLevelsConfigSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    enabled: {
      type: Boolean,
      default: false,
    },

    levelUpChannelId: {
      type: String,
      default: "",
    },

    levelUpChannelName: {
      type: String,
      default: "",
    },

    sendLevelUpMessage: {
      type: Boolean,
      default: true,
    },

    levelUpContent: {
      type: String,
      default: "🎉 GG {user}! You reached **Level {level}**!",
    },

    embedEnabled: {
      type: Boolean,
      default: true,
    },

    embedTitle: {
      type: String,
      default: "🏆 Level Up!",
    },

    embedDescription: {
      type: String,
      default: "{user} has reached **Level {level}** in **{server}**!",
    },

    embedColor: {
      type: String,
      default: "#8b5cf6",
    },

    embedFooter: {
      type: String,
      default: "Keep chatting to level up!",
    },

    embedThumbnail: {
      type: String,
      default: "",
    },

    embedImage: {
      type: String,
      default: "",
    },

    minXp: {
      type: Number,
      default: 15,
      min: 1,
    },

    maxXp: {
      type: Number,
      default: 25,
      min: 1,
    },

    cooldownSeconds: {
      type: Number,
      default: 60,
      min: 5,
    },

    rewards: {
      type: [levelRewardSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 25;
        },
        message: "Levels can have a maximum of 25 role rewards.",
      },
    },

    ignoredChannels: {
      type: [levelIgnoredChannelSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 50;
        },
        message: "Levels can have a maximum of 50 ignored channels.",
      },
    },

    noXpRoles: {
      type: [levelNoXpRoleSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 50;
        },
        message: "Levels can have a maximum of 50 no-XP roles.",
      },
    },

    multiplierRoles: {
      type: [levelMultiplierRoleSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 25;
        },
        message: "Levels can have a maximum of 25 multiplier roles.",
      },
    },
  },
  { timestamps: true }
);

module.exports = serverDb.models.DashboardLevelsConfig || serverDb.model("DashboardLevelsConfig", dashboardLevelsConfigSchema);
