const { connectAllMongoDatabases, getDbStatus } = require("./database/connections");
require("dotenv").config();

console.log(`
██╗     ███████╗ ██████╗ ███████╗███╗   ██╗██████╗  █████╗ ██████╗ ██╗   ██╗
██║     ██╔════╝██╔════╝ ██╔════╝████╗  ██║██╔══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝
██║     █████╗  ██║  ███╗█████╗  ██╔██╗ ██║██║  ██║███████║██████╔╝ ╚████╔╝
██║     ██╔══╝  ██║   ██║██╔══╝  ██║╚██╗██║██║  ██║██╔══██║██╔══██╗  ╚██╔╝
███████╗███████╗╚██████╔╝███████╗██║ ╚████║██████╔╝██║  ██║██║  ██║   ██║
╚══════╝╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝

🔥 LEGENDARY BOT v20.2.1
🧠 Smart AI System Activated
💾 MongoDB Connecting...
🌐 Dashboard Starting Instantly...
🚀 Starting...
`);

const {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const loopManager = require("./managers/loopManager");
const sportsLoopManager = require("./managers/sportsLoopManager");
const autoMessageManager = require("./managers/autoMessageManager");
const predictionManager = require("./managers/predictionManager");
const moderationManager = require("./managers/moderationManager");
const aiTicketManager = require("./managers/aiTicketManager");
const aiMentionChatManager = require("./managers/aiMentionChatManager");
const giveawayV2Manager = require("./managers/giveawayV2Manager");
const dashboardGiveawayManager = require("./managers/dashboardGiveawayManager");
const giveXManager = require("./managers/giveXManager");
const startDashboard = require("./dashboard/server");
const { refreshRoleAccessCache, canUseAccess } = require("./utils/roleAccess");
const AfkStatus = require("./models/AfkStatus");

const PREFIX = "$";

function isLegendaryAdmin(member) {
  if (!member) return false;

  return (
    member.permissions.has("Administrator") ||
    member.permissions.has("ManageGuild") ||
    member.permissions.has("ModerateMembers") ||
    member.permissions.has("BanMembers") ||
    member.permissions.has("KickMembers") ||
    member.permissions.has("ManageMessages") ||
    member.permissions.has("ManageChannels")
  );
}

function getCommandAccessLevel(command) {
  if (!command) return "public";
  if (command.accessLevel) return command.accessLevel;
  if (command.adminOnly) return "admin";
  if (command.staffOnly) return "staff";
  return "public";
}

async function canRunCommand(member, command) {
  if (!command) return false;
  const level = getCommandAccessLevel(command);
  if (level === "public") return true;

  if (member?.guild) {
    await refreshRoleAccessCache(member.guild);
  }

  return canUseAccess(member, level);
}

async function sendPermissionDenyMessage(target, command) {
  const level = getCommandAccessLevel(command);
  const content =
    level === "admin"
      ? "❌ This is an admin/manager command. You don’t have permission to use it."
      : level === "mod"
        ? "❌ This is a mod command. You don’t have permission to use it."
        : "❌ This is a staff command. You don’t have permission to use it.";

  if (target?.reply && target?.isRepliable?.()) {
    return target.reply({ content, ephemeral: true }).catch(() => null);
  }

  if (target?.reply) {
    const reply = await target.reply(content).catch(() => null);
    if (reply) setTimeout(() => reply.delete().catch(() => null), 8000);
    return reply;
  }

  return null;
}

async function denyAdminOnlyCommand(target) {
  const content = "❌ This is an admin-only command. You don’t have permission to use it.";

  if (target?.reply) {
    return target.reply({ content, ephemeral: true }).catch(() => null);
  }

  if (target?.channel) {
    return target.channel.send(content).catch(() => null);
  }

  return null;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const ALIASES = {
  "8ball": "eightball",
  "8b": "eightball",
  "commands": "help",
  "h": "help",
  "clearwarns": "clearwarnings",
  "warns": "warnings",
  "rr": "reactionroles",
  "away": "afk",
};



// Slash command groups keep the bot under Discord's 100 application command limit.
// These old standalone slash commands still work as PREFIX commands,
// but they are not registered as individual slash commands anymore.
// Use /moderation <subcommand> for these actions.
const GROUPED_LEGACY_SLASH_COMMANDS = new Set([
  "ban",
  "kick",
  "unban",
  "mute",
  "unmute",
  "warn",
  "warnings",
  "clearwarnings",
  "purge",
  "clear",
  "purgebot",
  "purgeuser",
  "lock",
  "unlock",
  "slowmode",
  "nickname",
  "cleannick",
  "dehoist",
  "vcban",
  "unvcban",
  "hackban",
  "massban",
  "masskick",
  "massmute",
  "massunmute",
  "massdeafen",
  "massundeafen",
  "nuke",
  "strip",
]);

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

for (const file of commandFiles) {
  if (file.endsWith("Data.js") || file === "changelogData.js") continue;

  const command = require(path.join(commandsPath, file));

  if (Array.isArray(command)) continue;

  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);

    if (Array.isArray(command.aliases)) {
      for (const alias of command.aliases) {
        client.commands.set(String(alias).toLowerCase(), command);
      }
    }

    continue;
  }

  if (command.name && command.executePrefix) {
    client.commands.set(command.name, command);

    if (Array.isArray(command.aliases)) {
      for (const alias of command.aliases) {
        client.commands.set(String(alias).toLowerCase(), command);
      }
    }
  }
}

function normalizeHexColor(value, fallback = "#8b5cf6") {
  const color = String(value || "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : fallback;
}

function reactionRoleButtonStyle(styleName) {
  const styles = {
    Primary: ButtonStyle.Primary,
    Secondary: ButtonStyle.Secondary,
    Success: ButtonStyle.Success,
    Danger: ButtonStyle.Danger,
  };

  return styles[styleName] || ButtonStyle.Secondary;
}

async function handleReactionRoleButton(interaction) {
  const DashboardReactionRolePanel = require("./models/DashboardReactionRolePanel");

  const parts = interaction.customId.split("_");
  const panelId = parts[1];
  const buttonIndex = Number(parts[2]);

  if (!panelId || Number.isNaN(buttonIndex)) {
    return interaction.reply({
      content: "❌ Invalid reaction role button.",
      ephemeral: true,
    });
  }

  const panel = await DashboardReactionRolePanel.findById(panelId);

  if (!panel || panel.guildId !== interaction.guildId || !panel.active) {
    return interaction.reply({
      content: "❌ This reaction role panel is no longer active.",
      ephemeral: true,
    });
  }

  const button = panel.buttons?.[buttonIndex];

  if (!button?.roleId) {
    return interaction.reply({
      content: "❌ This reaction role button is not configured.",
      ephemeral: true,
    });
  }

  const member = interaction.member;
  const role = interaction.guild.roles.cache.get(button.roleId);

  if (!role) {
    return interaction.reply({
      content: "❌ That role no longer exists.",
      ephemeral: true,
    });
  }

  const botMember = interaction.guild.members.me;

  if (!botMember.permissions.has("ManageRoles")) {
    return interaction.reply({
      content: "❌ I need the **Manage Roles** permission to do that.",
      ephemeral: true,
    });
  }

  if (role.position >= botMember.roles.highest.position) {
    return interaction.reply({
      content: "❌ I cannot manage that role because it is higher than or equal to my highest role.",
      ephemeral: true,
    });
  }

  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
    return interaction.reply({
      content: `✅ Removed role: **${role.name}**`,
      ephemeral: true,
    });
  }

  await member.roles.add(role);
  return interaction.reply({
    content: `✅ Added role: **${role.name}**`,
    ephemeral: true,
  });
}

async function getConfessionStyle(guildId) {
  const DashboardConfessionStyle = require("./models/DashboardConfessionStyle");

  let style = await DashboardConfessionStyle.findOne({ guildId });

  if (!style) {
    style = await DashboardConfessionStyle.create({ guildId });
  }

  return style;
}

function renderConfessionTitle(style, number) {
  const fallback = "💌 Anonymous Confession #{number}";
  const rawTitle = style?.embedTitle?.trim() || fallback;

  if (style?.showConfessionNumber === false) {
    return rawTitle.replaceAll("#{number}", "");
  }

  return rawTitle.replaceAll("#{number}", String(number));
}

function buildReactionLabel(style, emoji, count) {
  const customLabel = style?.reactionButtonLabel?.trim();

  if (customLabel && customLabel.toLowerCase() !== "react") {
    return `${customLabel} ${emoji} ${count || 0}`;
  }

  return `${emoji} ${count || 0}`;
}

function buildConfessionButtons(confession, style = null) {
  const reactions = confession.reactions || {};
  const replyLabel = style?.replyButtonLabel?.trim() || "Reply";

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confess_react_love_${confession.messageId}`)
        .setLabel(buildReactionLabel(style, "🤍", reactions.love))
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`confess_react_laugh_${confession.messageId}`)
        .setLabel(buildReactionLabel(style, "😂", reactions.laugh))
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`confess_react_cry_${confession.messageId}`)
        .setLabel(buildReactionLabel(style, "😭", reactions.cry))
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`confess_react_eyes_${confession.messageId}`)
        .setLabel(buildReactionLabel(style, "👀", reactions.eyes))
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId(`confess_reply_${confession.messageId}`)
        .setLabel(`💬 ${replyLabel}`)
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

function buildConfessionEmbed(number, text, style = null) {
  const anonymousLabel = style?.anonymousLabel?.trim() || "new confession!";
  const footerText =
    style?.embedFooter?.trim() || "💌 leave your own confession with /confess!";

  const embed = new EmbedBuilder()
    .setTitle(renderConfessionTitle(style, number))
    .setDescription(`${anonymousLabel}\n\n${text}`)
    .setColor(normalizeHexColor(style?.embedColor, "#ff8fab"))
    .setFooter({ text: footerText })
    .setTimestamp();

  if (style?.embedThumbnail?.trim()) {
    embed.setThumbnail(style.embedThumbnail.trim());
  }

  if (style?.embedImage?.trim()) {
    embed.setImage(style.embedImage.trim());
  }

  return embed;
}

function buildReplyEmbed(parentNumber, text, style = null) {
  const footerText = style?.embedFooter?.trim() || "Anonymous reply";
  const replyLabel = style?.replyButtonLabel?.trim() || "Reply";

  const embed = new EmbedBuilder()
    .setTitle(`💬 ${replyLabel} to Confession #${parentNumber}`)
    .setDescription(text)
    .setColor(normalizeHexColor(style?.embedColor, "#9b59b6"))
    .setFooter({ text: footerText })
    .setTimestamp();

  if (style?.embedThumbnail?.trim()) {
    embed.setThumbnail(style.embedThumbnail.trim());
  }

  if (style?.embedImage?.trim()) {
    embed.setImage(style.embedImage.trim());
  }

  return embed;
}

function calculateLevelFromXp(xp) {
  return Math.floor(0.1 * Math.sqrt(Number(xp || 0)));
}

function xpNeededForLevel(level) {
  return Math.pow(Number(level || 0) / 0.1, 2);
}

function randomXp(min, max) {
  const cleanMin = Math.max(1, Number(min || 15));
  const cleanMax = Math.max(cleanMin, Number(max || 25));

  return Math.floor(Math.random() * (cleanMax - cleanMin + 1)) + cleanMin;
}

function replaceLevelVars(text, message, levelUser, newLevel) {
  return String(text || "")
    .replaceAll("{user}", `<@${message.author.id}>`)
    .replaceAll("{username}", message.author.username || "Unknown User")
    .replaceAll("{server}", message.guild?.name || "this server")
    .replaceAll("{level}", String(newLevel || levelUser.level || 0))
    .replaceAll("{xp}", String(levelUser.xp || 0));
}

function normalizeLevelHex(value, fallback = "#8b5cf6") {
  const color = String(value || "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : fallback;
}


function memberHasAnyRole(member, roleList) {
  if (!member || !Array.isArray(roleList) || !roleList.length) return false;

  return roleList.some((item) => {
    if (!item?.roleId) return false;
    return member.roles.cache.has(item.roleId);
  });
}

function getMemberXpMultiplier(member, multiplierRoles) {
  if (!member || !Array.isArray(multiplierRoles) || !multiplierRoles.length) return 1;

  let highestMultiplier = 1;

  for (const item of multiplierRoles) {
    if (!item?.roleId) continue;
    if (!member.roles.cache.has(item.roleId)) continue;

    const multiplier = Number(item.multiplier || 1);

    if (multiplier > highestMultiplier) {
      highestMultiplier = multiplier;
    }
  }

  return Math.max(1, Math.min(highestMultiplier, 10));
}

function isLevelIgnoredChannel(message, config) {
  const ignoredChannels = Array.isArray(config.ignoredChannels)
    ? config.ignoredChannels
    : [];

  return ignoredChannels.some((item) => item.channelId === message.channelId);
}

function buildLevelUpEmbed(config, message, levelUser, newLevel) {
  const embed = new EmbedBuilder()
    .setColor(normalizeLevelHex(config.embedColor, "#8b5cf6"))
    .setTimestamp();

  if (config.embedTitle?.trim()) {
    embed.setTitle(replaceLevelVars(config.embedTitle, message, levelUser, newLevel));
  }

  if (config.embedDescription?.trim()) {
    embed.setDescription(replaceLevelVars(config.embedDescription, message, levelUser, newLevel));
  }

  if (config.embedFooter?.trim()) {
    embed.setFooter({
      text: replaceLevelVars(config.embedFooter, message, levelUser, newLevel),
    });
  }


  if (config.embedThumbnail?.trim()) {
    embed.setThumbnail(replaceLevelVars(config.embedThumbnail, message, levelUser, newLevel));
  }

  if (config.embedImage?.trim()) {
    embed.setImage(replaceLevelVars(config.embedImage, message, levelUser, newLevel));
  }

  return embed;
}

async function giveLevelRewards(message, config, newLevel) {
  try {
    const rewards = Array.isArray(config.rewards) ? config.rewards : [];
    if (!rewards.length) return;

    const member = message.member;
    if (!member) return;

    const botMember = message.guild.members.me;
    if (!botMember?.permissions?.has("ManageRoles")) return;

    for (const reward of rewards) {
      if (Number(reward.level) > Number(newLevel)) continue;

      const role = message.guild.roles.cache.get(reward.roleId);
      if (!role) continue;

      if (role.position >= botMember.roles.highest.position) continue;
      if (member.roles.cache.has(role.id)) continue;

      await member.roles.add(role).catch(() => null);
    }
  } catch (err) {
    console.error("[Levels Reward Error]", err.message || String(err));
  }
}

async function sendLevelUpMessage(message, config, levelUser, newLevel) {
  if (config.sendLevelUpMessage === false) return;

  const payload = {};

  if (config.levelUpContent?.trim()) {
    payload.content = replaceLevelVars(config.levelUpContent, message, levelUser, newLevel);
  }

  if (config.embedEnabled !== false) {
    payload.embeds = [buildLevelUpEmbed(config, message, levelUser, newLevel)];
  }

  if (!payload.content && !payload.embeds) return;

  const targetChannel = config.levelUpChannelId
    ? await message.client.channels.fetch(config.levelUpChannelId).catch(() => null)
    : message.channel;

  if (!targetChannel) return;
  if (targetChannel.guildId && targetChannel.guildId !== message.guildId) return;

  await targetChannel.send(payload).catch((err) => {
    console.error("[Levels Message Send Error]", err.message || String(err));
  });
}

async function handleLevelXp(message) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const DashboardLevelsConfig = require("./models/DashboardLevelsConfig");
    const DashboardLevelUser = require("./models/DashboardLevelUser");

    const config = await DashboardLevelsConfig.findOne({ guildId: message.guildId });
    if (!config || !config.enabled) return;

    if (isLevelIgnoredChannel(message, config)) {
      return;
    }

    const member = message.member;
    if (!member) return;

    if (memberHasAnyRole(member, config.noXpRoles)) {
      return;
    }

    const now = Date.now();
    const cooldownMs = Math.max(5, Number(config.cooldownSeconds || 60)) * 1000;

    let levelUser = await DashboardLevelUser.findOne({
      guildId: message.guildId,
      userId: message.author.id,
    });

    if (!levelUser) {
      levelUser = await DashboardLevelUser.create({
        guildId: message.guildId,
        userId: message.author.id,
        username: message.author.username,
        xp: 0,
        level: 0,
        lastXpAt: 0,
      });
    }

    if (levelUser.lastXpAt && now - Number(levelUser.lastXpAt) < cooldownMs) {
      return;
    }

    const oldLevel = Number(levelUser.level || 0);
    const baseXp = randomXp(config.minXp, config.maxXp);
    const multiplier = getMemberXpMultiplier(member, config.multiplierRoles);
    const gainedXp = Math.floor(baseXp * multiplier);

    levelUser.username = message.author.username;
    levelUser.xp = Number(levelUser.xp || 0) + gainedXp;
    levelUser.level = calculateLevelFromXp(levelUser.xp);
    levelUser.lastXpAt = now;

    await levelUser.save();

    const newLevel = Number(levelUser.level || 0);

    if (newLevel > oldLevel) {
      await giveLevelRewards(message, config, newLevel);
      await sendLevelUpMessage(message, config, levelUser, newLevel);
    }
  } catch (err) {
    console.error("[Levels XP Error]", err.message || String(err));
  }
}

function replaceWelcomeGoodbyeVars(text, member) {
  const guild = member.guild;

  return String(text || "")
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{username}", member.user?.username || "Unknown User")
    .replaceAll("{server}", guild.name || "this server")
    .replaceAll("{memberCount}", String(guild.memberCount || 0));
}

function normalizeDashboardHex(value, fallback = "#8b5cf6") {
  const color = String(value || "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : fallback;
}

function buildWelcomeGoodbyeEmbed(settings, member, type) {
  const isWelcome = type === "welcome";

  const title = isWelcome
    ? settings.welcomeEmbedTitle
    : settings.goodbyeEmbedTitle;

  const description = isWelcome
    ? settings.welcomeEmbedDescription
    : settings.goodbyeEmbedDescription;

  const color = isWelcome
    ? settings.welcomeEmbedColor
    : settings.goodbyeEmbedColor;

  const footer = isWelcome
    ? settings.welcomeEmbedFooter
    : settings.goodbyeEmbedFooter;

  const thumbnail = isWelcome
    ? settings.welcomeEmbedThumbnail
    : settings.goodbyeEmbedThumbnail;

  const image = isWelcome
    ? settings.welcomeEmbedImage
    : settings.goodbyeEmbedImage;

  const embed = new EmbedBuilder()
    .setColor(normalizeDashboardHex(color, isWelcome ? "#8b5cf6" : "#ff6b6b"))
    .setTimestamp();

  if (title?.trim()) {
    embed.setTitle(replaceWelcomeGoodbyeVars(title, member));
  }

  if (description?.trim()) {
    embed.setDescription(replaceWelcomeGoodbyeVars(description, member));
  }

  if (footer?.trim()) {
    embed.setFooter({ text: replaceWelcomeGoodbyeVars(footer, member) });
  }

  if (thumbnail?.trim()) {
    embed.setThumbnail(replaceWelcomeGoodbyeVars(thumbnail, member));
  }

  if (image?.trim()) {
    embed.setImage(replaceWelcomeGoodbyeVars(image, member));
  }

  return embed;
}

async function sendWelcomeGoodbyeMessage(member, type) {
  try {
    const DashboardWelcomeGoodbye = require("./models/DashboardWelcomeGoodbye");

    const guildId = member.guild.id;
    const settings = await DashboardWelcomeGoodbye.findOne({ guildId });

    if (!settings) return;

    const isWelcome = type === "welcome";

    const enabled = isWelcome
      ? settings.welcomeEnabled
      : settings.goodbyeEnabled;

    if (!enabled) return;

    const channelId = isWelcome
      ? settings.welcomeChannelId
      : settings.goodbyeChannelId;

    if (!channelId) return;

    const channel = await member.client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const normalContent = isWelcome
      ? settings.welcomeContent
      : settings.goodbyeContent;

    const embedEnabled = isWelcome
      ? settings.welcomeEmbedEnabled !== false
      : settings.goodbyeEmbedEnabled !== false;

    const payload = {};

    if (normalContent?.trim()) {
      payload.content = replaceWelcomeGoodbyeVars(normalContent, member);
    }

    if (embedEnabled) {
      const embed = buildWelcomeGoodbyeEmbed(settings, member, type);
      payload.embeds = [embed];
    }

    if (!payload.content && !payload.embeds) return;

    await channel.send(payload);
  } catch (err) {
    console.error(`[Welcome/Goodbye ${type} Error]`, err);
  }
}

async function getNextConfessionNumber(guildId) {
  const Confession = require("./models/Confession");

  const latest = await Confession.findOne({
    guildId,
    type: "confession",
    confessionNumber: { $ne: null },
  }).sort({ confessionNumber: -1 });

  return (latest?.confessionNumber || 0) + 1;
}

async function handleConfessionReaction(interaction) {
  const Confession = require("./models/Confession");

  const parts = interaction.customId.split("_");
  const reactionType = parts[2];
  const messageId = parts.slice(3).join("_");

  const validTypes = ["love", "laugh", "cry", "eyes"];
  if (!validTypes.includes(reactionType)) {
    return interaction.reply({ content: "❌ Invalid reaction.", ephemeral: true });
  }

  const confession = await Confession.findOne({
    guildId: interaction.guildId,
    messageId,
    type: "confession",
  });

  if (!confession) {
    return interaction.reply({
      content: "❌ This confession was not found in the database.",
      ephemeral: true,
    });
  }

  const userId = interaction.user.id;

  confession.reactions ||= { love: 0, laugh: 0, cry: 0, eyes: 0 };
  confession.reactionUsers ||= { love: [], laugh: [], cry: [], eyes: [] };

  for (const type of validTypes) {
    confession.reactionUsers[type] ||= [];

    if (confession.reactionUsers[type].includes(userId)) {
      confession.reactionUsers[type] = confession.reactionUsers[type].filter((id) => id !== userId);
      confession.reactions[type] = Math.max(0, (confession.reactions[type] || 0) - 1);
    }
  }

  confession.reactionUsers[reactionType].push(userId);
  confession.reactions[reactionType] = (confession.reactions[reactionType] || 0) + 1;

  await confession.save();

  const style = await getConfessionStyle(interaction.guildId);

  await interaction.update({
    embeds: [buildConfessionEmbed(confession.confessionNumber, confession.text, style)],
    components: buildConfessionButtons(confession, style),
  });
}
  
async function handleConfessionReplyButton(interaction) {
  const Confession = require("./models/Confession");

  const messageId = interaction.customId.replace("confess_reply_", "");

  const confession = await Confession.findOne({
    guildId: interaction.guildId,
    messageId,
    type: "confession",
  });

  if (!confession) {
    return interaction.reply({
      content: "❌ This confession was not found.",
      ephemeral: true,
    });
  }

  const style = await getConfessionStyle(interaction.guildId);
  const replyLabel = style?.replyButtonLabel?.trim() || "Reply";

  const modal = new ModalBuilder()
    .setCustomId(`confess_reply_modal_${messageId}`)
    .setTitle(`${replyLabel} to Confession #${confession.confessionNumber}`);

  const input = new TextInputBuilder()
    .setCustomId("confess_reply_text")
    .setLabel("Write your anonymous reply")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Type your reply here...")
    .setRequired(true)
    .setMaxLength(1500);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
}

async function handleConfessionReplyModal(interaction) {
  const Confession = require("./models/Confession");

  const parentMessageId = interaction.customId.replace("confess_reply_modal_", "");
  const replyText = interaction.fields.getTextInputValue("confess_reply_text");

  const parent = await Confession.findOne({
    guildId: interaction.guildId,
    messageId: parentMessageId,
    type: "confession",
  });

  if (!parent) {
    return interaction.reply({
      content: "❌ Original confession was not found.",
      ephemeral: true,
    });
  }

  const channel = await interaction.client.channels.fetch(parent.channelId).catch(() => null);

  if (!channel) {
    return interaction.reply({
      content: "❌ Confession channel was not found.",
      ephemeral: true,
    });
  }

  const style = await getConfessionStyle(interaction.guildId);
  const embed = buildReplyEmbed(parent.confessionNumber, replyText, style);
  const sent = await channel.send({ embeds: [embed] });
  
  await Confession.create({
    guildId: interaction.guildId,
    channelId: channel.id,
    messageId: sent.id,
    userId: interaction.user.id,
    username: interaction.user.username,
    text: replyText,
    type: "reply",
    confessionNumber: null,
    parentMessageId: parent.messageId,
    parentConfessionNumber: parent.confessionNumber,
  });

  await interaction.reply({
    content: `✅ Your anonymous reply was posted for Confession #${parent.confessionNumber}.`,
    ephemeral: true,
  });
}

async function handleTicketOpen(interaction) {
  try {
    const DashboardTicketConfig = require("./models/DashboardTicketConfig");
    const config = await DashboardTicketConfig.findOne({ guildId: interaction.guildId });

    if (!config || config.enabled === false) {
      return interaction.reply({ content: "❌ Ticketing is not enabled.", ephemeral: true });
    }

    const existing = interaction.guild.channels.cache.find(
      (ch) => ch.name === `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`
    );

    if (existing) {
      return interaction.reply({ content: `✅ You already have a ticket: ${existing}`, ephemeral: true });
    }

    const permissionOverwrites = [
      { id: interaction.guild.roles.everyone.id, deny: ["ViewChannel"] },
      { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
      { id: interaction.guild.members.me.id, allow: ["ViewChannel", "SendMessages", "ManageChannels", "ReadMessageHistory"] },
    ];

    if (config.supportRoleId) {
      permissionOverwrites.push({
        id: config.supportRoleId,
        allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, ""),
      type: 0,
      parent: config.categoryId || null,
      permissionOverwrites,
      reason: `Ticket opened by ${interaction.user.username}`,
    });

    await channel.send({
      content: `${interaction.user}${config.supportRoleId ? ` <@&${config.supportRoleId}>` : ""}`,
      embeds: [
        new EmbedBuilder()
          .setColor("#8b5cf6")
          .setTitle("🎫 Ticket Opened")
          .setDescription("Please explain your issue. Staff will help you soon.")
          .setTimestamp(),
      ],
    });

    return interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
  } catch (err) {
    console.error("[Ticket Open Error]", err);
    return interaction.reply({ content: "❌ Failed to create ticket. Check my channel permissions.", ephemeral: true });
  }
}

async function handleCustomPrefixCommand(message, commandName) {
  const DashboardCustomCommand = require("./models/DashboardCustomCommand");
  const custom = await DashboardCustomCommand.findOne({
    guildId: message.guildId,
    trigger: commandName,
    enabled: true,
  });

  if (!custom) return false;

  const payload = {};
  if (custom.response?.trim()) payload.content = custom.response.trim();

  if (custom.embedEnabled) {
    const embed = new EmbedBuilder().setColor(normalizeHexColor(custom.embedColor, "#8b5cf6"));
    if (custom.embedTitle?.trim()) embed.setTitle(custom.embedTitle.trim());
    if (custom.embedDescription?.trim()) embed.setDescription(custom.embedDescription.trim());
    payload.embeds = [embed];
  }

  if (!payload.content && !payload.embeds) return true;
  await message.reply(payload);
  return true;
}

async function handleStarboardReaction(reaction, user) {
  try {
    if (user.bot) return;
    const message = reaction.message;
    if (!message.guild) return;

    const DashboardStarboardConfig = require("./models/DashboardStarboardConfig");
    const config = await DashboardStarboardConfig.findOne({ guildId: message.guild.id });
    if (!config || !config.enabled || !config.starboardChannelId) return;

    const expected = config.emoji || "⭐";
    const reactionName = reaction.emoji.name || reaction.emoji.toString();
    if (reactionName !== expected) return;

    if ((config.postedMessageIds || []).includes(message.id)) return;
    if (reaction.count < Number(config.threshold || 3)) return;

    const channel = await message.client.channels.fetch(config.starboardChannelId).catch(() => null);
    if (!channel || channel.guildId !== message.guild.id) return;

    const embed = new EmbedBuilder()
      .setColor("#facc15")
      .setTitle(`${expected} Starboard`)
      .setDescription(message.content || "[No text content]")
      .addFields({ name: "Original", value: `[Jump to message](${message.url})` })
      .setAuthor({ name: message.author?.username || "Unknown", iconURL: message.author?.displayAvatarURL?.() })
      .setTimestamp(message.createdAt || new Date());

    const firstImage = message.attachments?.find?.((a) => a.contentType?.startsWith("image/"));
    if (firstImage) embed.setImage(firstImage.url);

    await channel.send({ embeds: [embed] });
    config.postedMessageIds.push(message.id);
    await config.save();
  } catch (err) {
    console.error("[Starboard Error]", err.message || String(err));
  }
}


async function handleAfkSystem(message) {
  try {
    if (!message.guild || !message.author || message.author.bot) return;

    const content = message.content || "";
    const isAfkCommand = content.toLowerCase().startsWith(`${PREFIX}afk`) || content.toLowerCase().startsWith(`${PREFIX}away`);

    if (!isAfkCommand) {
      const ownAfk = await AfkStatus.findOne({ guildId: message.guild.id, userId: message.author.id });
      if (ownAfk) {
        await AfkStatus.deleteOne({ guildId: message.guild.id, userId: message.author.id }).catch(() => null);
        const reply = await message.reply("✅ Welcome back! I removed your AFK status.").catch(() => null);
        if (reply) setTimeout(() => reply.delete().catch(() => null), 8000);
      }
    }

    const mentionedUsers = [...message.mentions.users.values()].filter((user) => user.id !== message.author.id && !user.bot);
    if (!mentionedUsers.length) return;

    const afkList = [];
    for (const user of mentionedUsers.slice(0, 5)) {
      const afk = await AfkStatus.findOne({ guildId: message.guild.id, userId: user.id });
      if (afk) afkList.push({ user, afk });
    }

    if (!afkList.length) return;

    const lines = afkList.map(({ user, afk }) => {
      const since = afk.createdAt ? `<t:${Math.floor(new Date(afk.createdAt).getTime() / 1000)}:R>` : "recently";
      return `💤 **${user.username}** is AFK: ${afk.reason || "AFK"} • ${since}`;
    });

    const reply = await message.reply(lines.join("\n")).catch(() => null);
    if (reply) setTimeout(() => reply.delete().catch(() => null), 18000);
  } catch (err) {
    console.error("[AFK System Error]", err?.message || err);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.username}`);

  await loopManager.init(client);
  await sportsLoopManager.init(client);
  await autoMessageManager.init(client);
  await aiTicketManager.init(client);
  await giveXManager.init(client);

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  const slashCommandsToRegister = [...new Map(
    [...client.commands.values()]
      .filter((cmd) => cmd.data && !cmd.prefixOnly)
      .filter((cmd) => !GROUPED_LEGACY_SLASH_COMMANDS.has(cmd.data.name))
      .map((cmd) => [cmd.data.name, cmd])
  ).values()];

  const commandData = slashCommandsToRegister.map((cmd) => cmd.data.toJSON());
  const skippedGroupedCommands = [...GROUPED_LEGACY_SLASH_COMMANDS].filter((name) => client.commands.has(name));
  console.log(`Slash command groups enabled: ${skippedGroupedCommands.length} legacy commands are now under /moderation.`);

  if (commandData.length > 100) {
    console.warn(`⚠️ Discord allows max 100 global slash commands. Current payload has ${commandData.length}. Keeping first 100 so deploy does not fail.`);
    commandData.length = 100;
  }

  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(readyClient.user.id), { body: commandData });
    console.log(`Successfully registered ${commandData.length} slash command(s).`);
  } catch (error) {
    console.error("Failed to register commands:", error);
  }

  startDashboard(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error("Autocomplete error:", err);
      }
    }
    return;
  }

  if (interaction.isButton()) {
    for (const command of client.commands.values()) {
      if (typeof command.handleButton === "function") {
        const handled = await command.handleButton(interaction);
        if (handled) return;
      }
    }
    
    if (interaction.customId === "roastback_open") {
      const { buildRoastBackStyleButtons, getBlockedMessage } = require("./commands/roast");

      const blocked = getBlockedMessage(interaction.user.id, interaction.member);
      if (blocked) {
        await interaction.reply({ content: blocked, ephemeral: true });
        return;
      }

      await interaction.reply({
        content: "🔥 Choose your roast-back style:",
        components: [buildRoastBackStyleButtons()],
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId.startsWith("roastback_style_")) {
      const { buildRoastModal, getBlockedMessage } = require("./commands/roast");

      const blocked = getBlockedMessage(interaction.user.id, interaction.member);
      if (blocked) {
        await interaction.reply({ content: blocked, ephemeral: true });
        return;
      }

      const style = interaction.customId.replace("roastback_style_", "");
      await interaction.showModal(buildRoastModal(style));
      return;
    }

    if (interaction.customId.startsWith("pred_vote_")) {
      const optionIndex = Number(interaction.customId.replace("pred_vote_", ""));
      const result = await predictionManager.recordVote(
        interaction.guildId,
        interaction.user.id,
        optionIndex
      );

      if (!result.ok) {
        await interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
        return;
      }

      await interaction.update({
        embeds: [predictionManager.buildPredictionEmbed(result.prediction)],
        components: predictionManager.buildPredictionButtons(true),
      });

      return;
    }

        if (interaction.customId === "ticket_open") {
      await handleTicketOpen(interaction);
      return;
    }

    if (interaction.customId.startsWith("join_")) {
      await giveXManager.handleButton(interaction);
      return;
    }

    if (interaction.customId.startsWith("gv2_")) {
      await giveawayV2Manager.handleButton(interaction);
      return;
    }

    if (interaction.customId.startsWith("dash_ga_")) {
      await dashboardGiveawayManager.handleButton(interaction);
      return;
    }

    if (interaction.customId.startsWith("rr_")) {
      await handleReactionRoleButton(interaction);
      return;
    }

    if (interaction.customId.startsWith("confess_react_")) {
      await handleConfessionReaction(interaction);
      return;
    }

    if (interaction.customId.startsWith("confess_reply_")) {
      await handleConfessionReplyButton(interaction);
      return;
    }

    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("roastback_modal_")) {
      const {
        generateComebackRoast,
        buildRoastBackButton,
        getBlockedMessage,
        recordRoastUse,
      } = require("./commands/roast");

      const blocked = getBlockedMessage(interaction.user.id, interaction.member);
      if (blocked) {
        await interaction.reply({ content: blocked, ephemeral: true });
        return;
      }

      const style = interaction.customId.replace("roastback_modal_", "");
      const userRoast = interaction.fields.getTextInputValue("user_roast");
      const userName = interaction.member?.displayName ?? interaction.user.username;

      await interaction.deferReply();
      recordRoastUse(interaction.user.id, interaction.member);

      try {
        const comeback = await generateComebackRoast(userName, userRoast, style);
        await interaction.editReply({
          content: `🔥 **${interaction.user} said:** *"${userRoast}"*\n\n💀 **Bot fires back (${style}):**\n${comeback}`,
          components: [buildRoastBackButton()],
        });
      } catch (err) {
        console.error("Roast comeback error:", err);
        await interaction.editReply("❌ Couldn't cook up a comeback. Try again.");
      }

      return;
    }

    if (interaction.customId.startsWith("auto_message_modal_")) {
      const channelId = interaction.customId.replace("auto_message_modal_", "");
      const cmd = require("./commands/setautomessage");
      await cmd.handleModalSubmit(interaction, channelId);
      return;
    }

    if (interaction.customId === "confess_modal") {
      const LoopConfig = require("./models/LoopConfig");
      const Confession = require("./models/Confession");

      const text = interaction.fields.getTextInputValue("confess_text");

      const config = await LoopConfig.findOne({ guildId: interaction.guildId });
      const confessChannelId = config?.confessChannelId;

      if (!confessChannelId) {
        return interaction.reply({
          content: "❌ Confession channel is not set yet. Ask an admin to use `/setconfesschannel`.",
          ephemeral: true,
        });
      }

      const channel = await interaction.client.channels.fetch(confessChannelId).catch(() => null);

      if (!channel) {
        return interaction.reply({
          content: "❌ Confession channel was not found.",
          ephemeral: true,
        });
      }

      const confessionNumber = await getNextConfessionNumber(interaction.guildId);

      const starterDoc = {
        guildId: interaction.guildId,
        channelId: channel.id,
        messageId: "pending",
        userId: interaction.user.id,
        username: interaction.user.username,
        text,
        type: "confession",
        confessionNumber,
        parentMessageId: null,
        parentConfessionNumber: null,
        reactions: {
          love: 0,
          laugh: 0,
          cry: 0,
          eyes: 0,
        },
        reactionUsers: {
          love: [],
          laugh: [],
          cry: [],
          eyes: [],
        },
      };

      const style = await getConfessionStyle(interaction.guildId);
      const embed = buildConfessionEmbed(confessionNumber, text, style);
      const sent = await channel.send({ embeds: [embed] });

      starterDoc.messageId = sent.id;

      const saved = await Confession.create(starterDoc);

      await sent.edit({
        embeds: [buildConfessionEmbed(confessionNumber, text, style)],
        components: buildConfessionButtons(saved, style),
      });

      await interaction.reply({
        content: `✅ Confession sent to ${channel}`,
        ephemeral: true,
      });

      return;
    }

    if (interaction.customId.startsWith("confess_reply_modal_")) {
      await handleConfessionReplyModal(interaction);
      return;
    }

    for (const command of client.commands.values()) {
      if (typeof command.handleModalSubmit === "function") {
        const handled = await command.handleModalSubmit(interaction, client);
        if (handled) return;
      }
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    if (interaction.guild && interaction.member) {
      await refreshRoleAccessCache(interaction.guild);
    }

    if (!(await canRunCommand(interaction.member, command))) {
      return sendPermissionDenyMessage(interaction, command);
    }

    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const msg = { content: "Something went wrong while running that command.", ephemeral: true };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
});


client.on(Events.ChannelCreate, async (channel) => {
  await aiTicketManager.handleChannelCreate(channel);
});

client.on(Events.GuildMemberAdd, async (member) => {
  await moderationManager.handleAntiRaidJoin(member);
  await sendWelcomeGoodbyeMessage(member, "welcome");
});

client.on(Events.GuildMemberRemove, async (member) => {
  await sendWelcomeGoodbyeMessage(member, "goodbye");
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  await handleStarboardReaction(reaction, user);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  await handleAfkSystem(message);

  if (await aiMentionChatManager.handleMention(message, client)) return;

  if (await aiTicketManager.handleMessage(message)) return;

  if (await moderationManager.handleAutoModeration(message)) return;

  await handleLevelXp(message);

  if (!message.content.startsWith(PREFIX)) return;
  
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const rawName = args.shift()?.toLowerCase();

  if (!rawName) return;

  const commandName = ALIASES[rawName] ?? rawName;

  if (await handleCustomPrefixCommand(message, commandName)) return;

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    if (message.guild && message.member) {
      await refreshRoleAccessCache(message.guild);
    }

    if (!(await canRunCommand(message.member, command))) {
      return sendPermissionDenyMessage(message, command);
    }

    if (typeof command.executePrefix !== "function") {
      const reply = await message.reply("❌ This command does not support prefix mode yet. Try the slash command version.").catch(() => null);
      if (reply) setTimeout(() => reply.delete().catch(() => null), 8000);
      return;
    }

    await command.executePrefix(message, args);
  } catch (error) {
    console.error(`Error executing ${PREFIX}${commandName}:`, error);
    await message.reply("Something went wrong while running that command.");
  }
});



// Phase 18A: connect all configured MongoDB databases.
// If split DB variables are missing, each scope safely falls back to MONGODB_URI.
const legendaryMongoConnections = connectAllMongoDatabases();
global.legendaryMongoConnections = legendaryMongoConnections;
global.legendaryMongoStatus = getDbStatus;

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("❌ Discord login failed:", error);
});
