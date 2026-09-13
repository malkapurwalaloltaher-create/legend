const mongoose = require("mongoose");
const { connectAllMongoDatabases, getFallbackModel, findOneWithFallback, findWithFallback, countWithFallback } = require("../database/connections");
const { customerDb } = connectAllMongoDatabases();

const customerManageableGuildSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    guildName: { type: String, default: "" },
    icon: { type: String, default: "" },
    owner: { type: Boolean, default: false },
    permissions: { type: String, default: "0" },
  },
  { _id: false }
);

const customerAccountSchema = new mongoose.Schema(
  {
    discordUserId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: "" },
    globalName: { type: String, default: "" },
    discriminator: { type: String, default: "" },
    avatar: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },

    manageableGuilds: { type: [customerManageableGuildSchema], default: [] },

    lastLoginAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const fallbackPack = getFallbackModel("CustomerAccount", customerAccountSchema, "customer");
const CustomerAccountModel = fallbackPack.primaryModel;

CustomerAccountModel.mainFallbackModel = fallbackPack.mainModel;
CustomerAccountModel.findOneWithMainFallback = (query = {}, options = {}) =>
  findOneWithFallback(fallbackPack, query, options);
CustomerAccountModel.findWithMainFallback = (query = {}, projection = null, options = {}) =>
  findWithFallback(fallbackPack, query, projection, options);
CustomerAccountModel.countWithMainFallback = (query = {}) =>
  countWithFallback(fallbackPack, query);

module.exports = CustomerAccountModel;
