const express = require("express");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { getDbStatus } = require("../database/connections");
const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const versionInfo = require("../config/version");

const LoopConfig = require("../models/LoopConfig");
const Confession = require("../models/Confession");
const DashboardAutoMessage = require("../models/DashboardAutoMessage");
const DashboardSportsConfig = require("../models/DashboardSportsConfig");
const DashboardLoopContent = require("../models/DashboardLoopContent");
const DashboardEmbedTemplate = require("../models/DashboardEmbedTemplate");
const DashboardConfessionStyle = require("../models/DashboardConfessionStyle");
const DashboardWelcomeGoodbye = require("../models/DashboardWelcomeGoodbye");
const DashboardReactionRolePanel = require("../models/DashboardReactionRolePanel");
const DashboardLevelsConfig = require("../models/DashboardLevelsConfig");
const DashboardLevelUser = require("../models/DashboardLevelUser");
const DashboardModuleConfig = require("../models/DashboardModuleConfig");
const DashboardCustomCommand = require("../models/DashboardCustomCommand");
const DashboardTicketConfig = require("../models/DashboardTicketConfig");
const AITicketConfig = require("../models/AITicketConfig");
const CommandCenterLog = require("../models/CommandCenterLog");
const DashboardStarboardConfig = require("../models/DashboardStarboardConfig");
const ModerationConfig = require("../models/ModerationConfig");
const ModerationCase = require("../models/ModerationCase");
const ModerationWarning = require("../models/ModerationWarning");
const ModerationNote = require("../models/ModerationNote");
const ModerationVcBan = require("../models/ModerationVcBan");
const DashboardLoginLog = require("../models/DashboardLoginLog");
const GuildPlan = require("../models/GuildPlan");
const DashboardActionLog = require("../models/DashboardActionLog");
const CustomerAccount = require("../models/CustomerAccount");
const DashboardSupportConfig = require("../models/DashboardSupportConfig");
const GuildModuleUnlock = require("../models/GuildModuleUnlock");
const AiMentionChatConfig = require("../models/AiMentionChatConfig");
const DashboardGiveawayConfig = require("../models/DashboardGiveawayConfig");
const DashboardGiveawayRun = require("../models/DashboardGiveawayRun");
const DashboardAnalyticsConfig = require("../models/DashboardAnalyticsConfig");
const DashboardWorkflowConfig = require("../models/DashboardWorkflowConfig");
const DashboardAiV2Config = require("../models/DashboardAiV2Config");
const DashboardEventCenterConfig = require("../models/DashboardEventCenterConfig");
const DashboardEventItem = require("../models/DashboardEventItem");
const DashboardBirthday = require("../models/DashboardBirthday");
const DashboardEventLog = require("../models/DashboardEventLog");

const loopManager = require("../managers/loopManager");
const sportsLoopManager = require("../managers/sportsLoopManager");
const aiMentionChatManager = require("../managers/aiMentionChatManager");

let dashboardStarted = false;
const autoMessageIntervals = new Map();

function getScopedPath(req, path = "/dashboard") {
  const selectedGuildId = req.params?.guildId || req.session?.selectedGuildId || req.session?.guildId || "";
  const cleanPath = String(path || "/dashboard").startsWith("/") ? String(path || "/dashboard") : `/${path}`;
  if (req.originalUrl?.startsWith("/owner/") && selectedGuildId) return `/owner/${selectedGuildId}${cleanPath}`;
  if (req.originalUrl?.startsWith("/customer/") && selectedGuildId) {
    const userId = req.params?.userId || req.session?.customerId || req.session?.userId || req.session?.discordUser?.id || "";
    return userId ? `/customer/${userId}${cleanPath}` : cleanPath;
  }
  return cleanPath;
}

function wantsJsonResponse(req) {
  return (
    req.xhr ||
    req.headers.accept?.includes("application/json") ||
    req.headers["x-requested-with"] === "XMLHttpRequest" ||
    req.headers["x-dashboard-ajax"] === "1"
  );
}

function dashboardJsonOrRedirect(req, res, redirectUrl, payload = {}) {
  const safePayload = {
    ok: payload.ok !== false,
    message: payload.message || (payload.ok === false ? "Action failed" : "Action completed"),
    redirect: payload.redirect || null,
    reload: Boolean(payload.reload),
    data: payload.data || null,
  };

  if (wantsJsonResponse(req)) {
    return res.status(safePayload.ok ? 200 : (payload.statusCode || 400)).json(safePayload);
  }

  const url = new URL(redirectUrl, "https://legendary.local");
  url.searchParams.set(safePayload.ok ? "success" : "error", safePayload.message);
  return res.redirect(url.pathname + url.search);
}

function dashboardJsonOrBack(req, res, payload = {}) {
  return dashboardJsonOrRedirect(req, res, req.get("referer") || "/dashboard", payload);
}


function startDashboard(client) {

  // HOTFIX 18.3.1 FALLBACK HELPERS
  // These must live inside startDashboard so dashboard routes and restore functions can access them.
  async function modelFindOneSafe(Model, query = {}, options = {}) {
    if (Model && typeof Model.findOneWithMainFallback === "function") {
      return Model.findOneWithMainFallback(query, options);
    }

    return Model.findOne(query, null, options);
  }

  async function modelFindSafe(Model, query = {}, projection = null, options = {}) {
    if (Model && typeof Model.findWithMainFallback === "function") {
      return Model.findWithMainFallback(query, projection, options);
    }

    return Model.find(query, projection, options);
  }

  async function modelCountSafe(Model, query = {}) {
    if (Model && typeof Model.countWithMainFallback === "function") {
      return Model.countWithMainFallback(query);
    }

    return Model.countDocuments(query);
  }

  function getDashboardCommandAccessLevel(command) {
    if (!command) return "public";
    if (command.accessLevel) return command.accessLevel;
    if (command.ownerOnly) return "owner";
    if (command.adminOnly) return "admin";
    if (command.staffOnly) return "staff";
    if (command.modOnly) return "mod";
    return "public";
  }


  if (dashboardStarted) {
    console.log("🌐 Dashboard already running, skipping duplicate start.");
    return;
  }

  dashboardStarted = true;

  const app = express();
  const PORT = process.env.PORT || 8080;
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || process.env.DASHBOARD_LOGIN_PASSWORD || "legendary123";
  const SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET || process.env.SESSION_SECRET || "legendary-dashboard-secret";
  const DASHBOARD_VERSION = versionInfo.version;

  const DASHBOARD_PUBLIC_URL =
    process.env.DASHBOARD_PUBLIC_URL ||
    `http://localhost:${PORT}`;

  const DISCORD_CLIENT_ID =
    process.env.DISCORD_CLIENT_ID ||
    process.env.CLIENT_ID ||
    client.user?.id ||
    "";

  const DISCORD_CLIENT_SECRET =
    process.env.DISCORD_CLIENT_SECRET ||
    "";

  const DISCORD_REDIRECT_URI =
    process.env.DISCORD_REDIRECT_URI ||
    `${DASHBOARD_PUBLIC_URL.replace(/\/$/, "")}/auth/discord/callback`;


  const PREMIUM_MODULE_KEYS = new Set([
    "message-builder",
    "announcements",
    "confession-style",
    "yap-rumors",
    "starboards",
    "embed-templates",
    "moderation",
    "automations",
    "custom-commands",
    "giveaways",
    "ticketing",
    "sports",
    "predictions",
    "search-anything",
  ]);

  const PREMIUM_ROUTE_PREFIXES = [
    "/message-builder",
    "/announcements",
    "/confession-style",
    "/yap-rumors",
    "/starboards",
    "/embed-templates",
    "/moderation",
    "/automations",
    "/custom-commands",
    "/dashboard/giveaways",
    "/giveaways",
    "/ticketing",
    "/sports",
    "/predictions",
    "/search-anything",
  ];

const navSections = [
  {
    title: "MAIN",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        icon: "🏠",
        href: "/dashboard",
        desc: "View your bot’s main control panel, overall status, quick stats, connected servers, command count, uptime, and shortcuts to the most important dashboard tools.",
      },
      {
        key: "message-builder",
        label: "Message Builder",
        icon: "📝",
        href: "/message-builder",
        desc: "Create normal messages and rich embeds with custom titles, descriptions, colors, images, footers, buttons, and previews before sending them directly to your selected channel.",
      },
      {
        key: "settings",
        label: "Settings",
        icon: "⚙️",
        href: "/settings",
        desc: "Manage core dashboard settings like login behavior, selected server preferences, bot visuals, interface options, and other important configuration controls for your panel.",
      },
      {
        key: "premium-control",
        label: "Premium Control",
        icon: "💎",
        href: "/premium-control",
        badge: "Owner",
        desc: "Owner-only Premium control panel. Enable full server Premium, unlock individual premium modules, and manage customer support contact settings.",
      },
      {
        key: "owner-command-center",
        label: "Command Center",
        icon: "👑",
        href: "/owner-command-center",
        badge: "Owner",
        desc: "Open the Legendary Command Center with a Discord-style server/channel/message view, live chat polling, older message loading, and bot-powered message sending.",
      },
    ],
  },
  {
    title: "ESSENTIALS",
    items: [
      {
        key: "confessions",
        label: "Confessions",
        icon: "💌",
        href: "/confessions",
        badge: "Live",
        desc: "Manage anonymous confessions, reply tracking, confession numbers, channel setup, and message search tools so staff can safely review and organize confession activity.",
      },
      {
        key: "confession-style",
        label: "Confession Style",
        icon: "🎨",
        href: "/confession-style",
        badge: "Live",
        desc: "Customize the confession embed design with your own colors, labels, footer text, thumbnails, buttons, reactions, and preview styling for a cleaner anonymous message interface.",
      },
      {
        key: "auto-messages",
        label: "Auto Messages",
        icon: "⏰",
        href: "/auto-messages",
        badge: "Live",
        desc: "Create repeating automatic messages and embeds, choose channels, control intervals, enable or pause jobs, and preview what the bot will send before activating it.",
      },
      {
        key: "events",
        label: "Event Center",
        icon: "📅",
        href: "/dashboard/events",
        badge: "New",
        desc: "Create events, birthdays, festival announcements, reminders, and AI-style event messages from one dashboard.",
      },
      {
        key: "yap-rumors",
        label: "Yap & Rumors",
        icon: "🗣️",
        href: "/yap-rumors",
        badge: "Live",
        desc: "Control the yap and rumors systems, set channels and intervals, pause or resume loops, view recent activity, and manage fallback content directly from the dashboard.",
      },
      {
        key: "welcome-goodbye",
        label: "Welcome & Goodbye",
        icon: "👋",
        href: "/welcome-goodbye",
        badge: "Live",
        desc: "Build and manage welcome and goodbye messages with channel selection, embed toggles, custom placeholders, colors, previews, and test buttons for member join and leave events.",
      },
      {
        key: "reaction-roles",
        label: "Reaction Roles",
        icon: "🎭",
        href: "/reaction-roles",
        badge: "Live",
        desc: "Create reaction role panels with buttons, labels, emojis, custom colors, previews, and role mappings so members can assign roles to themselves in a clean way.",
      },
      {
        key: "levels",
        label: "Levels",
        icon: "🏆",
        href: "/levels",
        badge: "Live",
        desc: "Configure your leveling system including XP rewards, ignored channels, blocked roles, multiplier roles, level-up messages, reward roles, and the full level embed style.",
      },
      {
        key: "starboards",
        label: "Starboards",
        icon: "⭐",
        href: "/starboards",
        badge: "Live",
        desc: "Choose a starboard channel, set minimum reaction requirements, filter channels or roles, and control how highlighted messages are reposted into your server showcase.",
      },
    ],
  },
  {
    title: "SERVER MANAGEMENT",
    items: [
      {
        key: "announcements",
        label: "Announcements",
        icon: "📣",
        href: "/announcements",
        badge: "Live",
        desc: "Send polished announcements and server update messages with embeds, images, buttons, mentions, and custom layouts directly from your dashboard without typing manual commands.",
      },
      {
        key: "embed-templates",
        label: "Embed Templates",
        icon: "📦",
        href: "/embed-templates",
        badge: "Live",
        desc: "Save, manage, preview, reuse, and delete your custom embed templates so you can quickly apply the same style across announcements, confessions, welcome messages, and more.",
      },
      {
        key: "moderation",
        label: "Moderation",
        icon: "🛡️",
        href: "/moderation",
        badge: "Live",
        desc: "Manage moderation tools, punishment settings, staff utilities, and future dashboard-based moderation actions from one place as your server management system expands.",
      },
      {
        key: "automations",
        label: "Automations",
        icon: "🔁",
        href: "/automations",
        badge: "Live",
        desc: "Set up automated server workflows and future trigger-based actions to reduce manual work and keep your server systems running in a more organized way.",
      },
      {
        key: "custom-commands",
        label: "Custom Commands",
        icon: "⌨️",
        href: "/custom-commands",
        badge: "Live",
        desc: "Create and manage custom server commands, response text, embed replies, shortcuts, and future dashboard-powered command options for your community.",
      },
      {
        key: "ticketing",
        label: "Ticketing",
        icon: "🎫",
        href: "/ticketing",
        badge: "Live",
        desc: "Configure support ticket panels, channels, roles, categories, and panel messages so members can open help tickets using a clean dashboard-controlled setup.",
      },
      {
        key: "ai-tickets",
        label: "AI Tickets",
        icon: "🤖",
        href: "/ai-tickets",
        badge: "Owner",
        desc: "Owner-only AI TicketTool panel. Manage staff application scoring logic, auto approve role, review channel routing, report webhook, AI-copy detection, and future AI ticket modules.",
      },
      {
        key: "ai-chat",
        label: "AI Chat",
        icon: "💬",
        href: "/ai-chat",
        badge: "AI",
        desc: "Control mention-only AI chat replies, provider fallback, cooldowns, memory, personality, and allowed/ignored channels.",
      },
      {
        key: "ai-system-v2",
        label: "AI System V2",
        icon: "🧠",
        href: "/ai-system-v2",
        badge: "Soon",
        desc: "Advanced AI foundation for memory, provider fallback, personalities, safety limits, and future AI dashboard tools.",
      },
      {
        key: "giveaways",
        label: "Giveaways V2",
        icon: "🎉",
        href: "/dashboard/giveaways",
        badge: "Premium",
        desc: "Premium giveaway dashboard for creating, tracking, ending, rerolling, and managing server giveaways.",
      },
    ],
  },
  {
    title: "UTILITIES",
    items: [
      {
        key: "sports",
        label: "Sports",
        icon: "⚽",
        href: "/sports",
        badge: "Live",
        desc: "Manage cricket and football systems, update channels, scheduling options, match post settings, and sports message appearance from one organized dashboard section.",
      },
      {
        key: "predictions",
        label: "Predictions",
        icon: "🎯",
        href: "/predictions",
        badge: "Live",
        desc: "Configure prediction systems for sports or community events, control posting channels, track rounds, and manage how prediction messages appear in your server.",
      },
      {
        key: "polls",
        label: "Polls",
        icon: "📊",
        href: "/polls",
        badge: "Live",
        desc: "Create structured poll messages with options, embeds, buttons, and cleaner layouts so members can vote directly from your server with a more polished design.",
      },
      {
        key: "search-anything",
        label: "Search Anything",
        icon: "🔎",
        href: "/search-anything",
        badge: "Live",
        desc: "Use dashboard search tools to quickly find saved templates, confessions, auto messages, reaction role panels, settings, and other important server data in one place.",
      },
      {
        key: "analytics",
        label: "Analytics",
        icon: "📈",
        href: "/analytics",
        badge: "Soon",
        desc: "Central analytics foundation for server activity, commands, moderation, giveaways, tickets, levels, and future graphs.",
      },
      {
        key: "workflow-automations",
        label: "Workflows",
        icon: "🧩",
        href: "/workflow-automations",
        badge: "Soon",
        desc: "Future trigger/action automation builder for server workflows like member joins, ticket closes, and giveaway endings.",
      },
    ],
  },
];

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
  const start = Date.now();

  console.log(`[HTTP START] ${req.method} ${req.url}`);

  res.on("finish", () => {
    console.log(`[HTTP END] ${req.method} ${req.url} -> ${res.statusCode} in ${Date.now() - start}ms`);
  });

  next();
});
  app.use(express.json());

  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 * 60 * 24 },
    })
  );

  app.use(express.static(path.join(__dirname, "public")));

  app.get("/favicon.png", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(__dirname, "public", "favicon.png"));
  });

  app.get("/favicon.ico", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.join(__dirname, "public", "favicon.png"));
  });

  function requireAuth(req, res, next) {
    if (req.session && req.session.loggedIn) return next();
    return res.redirect("/login");
  }

  function requireOwnerAuth(req, res, next) {
    if (req.session?.ownerLoggedIn === true) {
      req.session.loggedIn = true;
      if (req.session.loginRole === "customer" || req.session.loginRole === "customer-oauth") {
        req.session.loginRole = "dashboard";
      }
      return next();
    }

    if (req.session && req.session.loggedIn && req.session.loginRole !== "customer" && req.session.loginRole !== "customer-oauth") return next();

    // Premium/owner routes must never fall back into customer dashboard flow.
    // If the same browser was used as a customer before, send them to owner login.
    if (req.path.startsWith("/premium-control") || req.path.startsWith("/settings/premium") || req.path.startsWith("/owner/")) {
      req.session.selectedGuildId = null;
    }

    return res.redirect("/login");
  }

  function isOwnerSession(req) {
    return Boolean(req.session && req.session.loggedIn && req.session.loginRole !== "customer" && req.session.loginRole !== "customer-oauth");
  }

  async function saveDashboardLoginLog(req, status, role, username, reason = "") {
    try {
      await DashboardLoginLog.create({
        username: String(username || "").slice(0, 80),
        role: role || "unknown",
        status: status || "unknown",
        reason: String(reason || "").slice(0, 300),
        ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });
    } catch (err) {
      console.error("[Dashboard Login Log Error]", err.message || String(err));
    }
  }

  async function getAdminServers() {
    const servers = [...client.guilds.cache.values()].sort((a, b) => a.name.localeCompare(b.name));

    return servers.map((guild) => ({
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount || 0,
      ownerId: guild.ownerId || "Unknown",
      icon: guild.iconURL({ extension: "png", size: 256, forceStatic: false }) || getBotAvatar(),
      botJoinedAt: guild.members.me?.joinedAt ? guild.members.me.joinedAt.toLocaleString() : "Unknown",
    }));
  }

  async function getAdminTextChannels(guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return [];

    await guild.channels.fetch().catch(() => null);

    return [...guild.channels.cache.values()]
      .filter((ch) => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map((ch) => ({ id: ch.id, name: ch.name }));
  }

  async function createOwnerModerationCase({ guildId, targetId = "", action, reason = "Owner dashboard action", durationMs = 0 }) {
    const latest = await ModerationCase.findOne({ guildId }).sort({ caseId: -1 }).catch(() => null);
    const caseId = Number(latest?.caseId || 0) + 1;

    return ModerationCase.create({
      guildId,
      caseId,
      action,
      targetId,
      targetTag: targetId ? `User ID: ${targetId}` : "",
      moderatorId: client.user?.id || "owner-dashboard",
      moderatorTag: "Owner Dashboard",
      reason,
      durationMs,
      metadata: { source: "owner-admin-panel" },
    });
  }


  async function createDashboardActionLog({
    guild,
    action,
    status = "success",
    targetId = "",
    targetTag = "",
    channelId = "",
    channelName = "",
    roleId = "",
    roleName = "",
    reason = "",
    details = {},
    error = "",
  }) {
    try {
      await DashboardActionLog.create({
        guildId: guild?.id || "",
        guildName: guild?.name || "",
        action: String(action || "unknown").slice(0, 80),
        status: String(status || "success").slice(0, 30),
        targetId: String(targetId || ""),
        targetTag: String(targetTag || "").slice(0, 120),
        channelId: String(channelId || ""),
        channelName: String(channelName || "").slice(0, 120),
        roleId: String(roleId || ""),
        roleName: String(roleName || "").slice(0, 120),
        reason: String(reason || "").slice(0, 500),
        details,
        error: String(error || "").slice(0, 800),
        executedBy: "owner-dashboard",
      });
    } catch (err) {
      console.error("[Dashboard Action Log Error]", err.message || String(err));
    }
  }

  function commandCenterCatalog() {
    return [
      {
        id: "moderation",
        label: "Moderation",
        icon: "🛡️",
        actions: [
          { id: "ban-user", label: "Ban User", needsUser: true, needsReason: true, dangerous: true, note: "Bans a selected member from the server." },
          { id: "unban-user", label: "Unban User ID", needsUserIdText: true, needsReason: true, note: "Unbans a user by Discord user ID." },
          { id: "kick-user", label: "Kick User", needsUser: true, needsReason: true, dangerous: true, note: "Kicks a selected member from the server." },
          { id: "timeout-user", label: "Mute / Timeout", needsUser: true, needsDuration: true, needsReason: true, note: "Times out the selected member." },
          { id: "untimeout-user", label: "Unmute / Remove Timeout", needsUser: true, needsReason: true, note: "Removes timeout from the selected member." },
          { id: "warn-user", label: "Warn User", needsUser: true, needsReason: true, note: "Adds a warning to MongoDB." },
          { id: "warnings-user", label: "View Warnings", needsUser: true, resultOnly: true, note: "Shows saved warnings for a user." },
          { id: "clearwarnings-user", label: "Clear Warnings", needsUser: true, needsReason: true, dangerous: true, note: "Deletes saved warnings for a user." },
          { id: "lock-channel", label: "Lock Channel", needsChannel: true, needsReason: true, note: "Disables Send Messages for @everyone." },
          { id: "unlock-channel", label: "Unlock Channel", needsChannel: true, needsReason: true, note: "Restores Send Messages for @everyone." },
          { id: "slowmode", label: "Set Slowmode", needsChannel: true, needsDuration: true, needsReason: true, note: "Sets channel slowmode seconds." },
        ],
      },
      {
        id: "messages",
        label: "Message Management",
        icon: "🧹",
        actions: [
          { id: "send-message", label: "Send Message", needsChannel: true, needsMessage: true, note: "Makes the bot send a message in the selected channel." },
          { id: "purge", label: "Purge Messages", needsChannel: true, needsAmount: true, dangerous: true, note: "Deletes recent messages in a channel." },
          { id: "purgebot", label: "Purge Bot Messages", needsChannel: true, needsAmount: true, dangerous: true, note: "Deletes recent bot messages in a channel." },
          { id: "purgeuser", label: "Purge User Messages", needsChannel: true, needsUser: true, needsAmount: true, dangerous: true, note: "Deletes recent messages by selected user." },
          { id: "nuke-channel", label: "Nuke Channel", needsChannel: true, needsReason: true, dangerous: true, confirmText: "NUKE", note: "Clones the channel, deletes the old one, and keeps position/topic when possible." },
        ],
      },
      {
        id: "user-management",
        label: "User Management",
        icon: "👤",
        actions: [
          { id: "nickname", label: "Change Nickname", needsUser: true, needsText: true, note: "Changes the selected member nickname." },
          { id: "cleannick", label: "Clear Nickname", needsUser: true, note: "Resets selected member nickname." },
          { id: "dehoist", label: "Dehoist Member", needsUser: true, note: "Moves hoisted names down by editing nickname." },
          { id: "strip-roles", label: "Strip Roles", needsUser: true, needsReason: true, dangerous: true, confirmText: "STRIP", note: "Removes manageable roles from selected member." },
        ],
      },
      {
        id: "advanced",
        label: "Advanced Moderation",
        icon: "🚫",
        actions: [
          { id: "hackban", label: "Hackban by User ID", needsUserIdText: true, needsReason: true, dangerous: true, note: "Bans a user by ID even if they are not currently in the server." },
          { id: "massban", label: "Mass Ban User IDs", needsUserIdsText: true, needsReason: true, dangerous: true, confirmText: "MASSBAN", note: "Bans multiple user IDs separated by commas/spaces." },
          { id: "masskick", label: "Mass Kick Selected Users", needsUserIdsText: true, needsReason: true, dangerous: true, confirmText: "MASSKICK", note: "Kicks multiple server members by ID." },
          { id: "massmute", label: "Mass Timeout Selected Users", needsUserIdsText: true, needsDuration: true, needsReason: true, dangerous: true, note: "Times out multiple server members by ID." },
          { id: "massunmute", label: "Mass Remove Timeout", needsUserIdsText: true, needsReason: true, dangerous: true, note: "Removes timeouts from multiple members by ID." },
        ],
      },
      {
        id: "voice",
        label: "Voice Moderation",
        icon: "🎤",
        actions: [
          { id: "massdeafen", label: "Mass Deafen", needsUserIdsText: true, needsReason: true, dangerous: true, note: "Server deafens multiple connected voice members." },
          { id: "massundeafen", label: "Mass Undeafen", needsUserIdsText: true, needsReason: true, note: "Removes server deaf from multiple members." },
          { id: "vcban", label: "VC Ban User", needsUser: true, needsReason: true, note: "Saves VC ban and disconnects member from voice." },
          { id: "unvcban", label: "UnVC Ban User", needsUser: true, needsReason: true, note: "Removes saved VC ban for selected user." },
        ],
      },
      {
        id: "notes-history",
        label: "Notes + History",
        icon: "📝",
        actions: [
          { id: "note", label: "Add Note", needsUser: true, needsText: true, note: "Saves a moderator note to MongoDB." },
          { id: "notes", label: "View Notes", needsUser: true, resultOnly: true, note: "Shows saved notes for selected user." },
          { id: "clearnotes", label: "Clear Notes", needsUser: true, dangerous: true, note: "Deletes saved notes for selected user." },
          { id: "history", label: "View History", needsUser: true, resultOnly: true, note: "Shows moderation cases for selected user." },
        ],
      },
      {
        id: "roles",
        label: "Role Management",
        icon: "📋",
        actions: [
          { id: "setcolor", label: "Set Role Color", needsRole: true, needsHex: true, note: "Changes a role color." },
          { id: "mentionable", label: "Toggle Mentionable", needsRole: true, note: "Toggles role mentionable state." },
          { id: "roledump", label: "Role Member List", needsRole: true, resultOnly: true, note: "Shows users with the selected role." },
        ],
      },
      {
        id: "invites",
        label: "Invite Management",
        icon: "🔗",
        actions: [
          { id: "invites", label: "View Invites", resultOnly: true, note: "Shows server invite uses." },
          { id: "clearinvites", label: "Delete All Invites", dangerous: true, confirmText: "CLEARINVITES", note: "Deletes existing invites the bot can manage." },
          { id: "createinvite", label: "Create Invite", needsChannel: true, note: "Creates an invite for the selected channel." },
        ],
      },
      {
        id: "server-setup",
        label: "Server Setup",
        icon: "⚙️",
        actions: [
          { id: "setlog", label: "Set Log Channel", needsChannel: true, note: "Saves moderation log channel." },
          { id: "setwelcome", label: "Set Welcome Channel", needsChannel: true, note: "Saves welcome channel." },
          { id: "setverify", label: "Set Verify Channel + Role", needsChannel: true, needsRole: true, note: "Saves verification channel and role." },
        ],
      },
      {
        id: "security",
        label: "Security / AutoMod",
        icon: "🛡️",
        actions: [
          { id: "automod-on", label: "Automod ON", note: "Turns automod on." },
          { id: "automod-off", label: "Automod OFF", note: "Turns automod off." },
          { id: "antilink-on", label: "AntiLink ON", note: "Turns anti-link on." },
          { id: "antilink-off", label: "AntiLink OFF", note: "Turns anti-link off." },
          { id: "antispam-on", label: "AntiSpam ON", note: "Turns anti-spam on." },
          { id: "antispam-off", label: "AntiSpam OFF", note: "Turns anti-spam off." },
          { id: "antiraid-on", label: "AntiRaid ON", note: "Turns anti-raid on." },
          { id: "antiraid-off", label: "AntiRaid OFF", note: "Turns anti-raid off." },
        ],
      },
      {
        id: "info",
        label: "Info Commands",
        icon: "👤",
        actions: [
          { id: "userinfo", label: "User Info", needsUser: true, resultOnly: true, note: "Shows selected user information." },
          { id: "avatar", label: "Avatar", needsUser: true, resultOnly: true, note: "Shows selected user avatar URL." },
          { id: "serverinfo", label: "Server Info", resultOnly: true, note: "Shows server information." },
          { id: "servericon", label: "Server Icon", resultOnly: true, note: "Shows server icon URL." },
        ],
      },
      {
        id: "fun-utility",
        label: "Fun + Utility",
        icon: "🎉",
        actions: [
          { id: "choose", label: "Choose Option", needsText: true, resultChannelOptional: true, note: "Type options separated by commas." },
          { id: "reverse", label: "Reverse Text", needsText: true, resultChannelOptional: true, note: "Reverses your text." },
          { id: "roll", label: "Roll Dice", resultChannelOptional: true, note: "Rolls a number from 1 to 100." },
          { id: "coinflip", label: "Coin Flip", resultChannelOptional: true, note: "Flips heads/tails." },
          { id: "eightball", label: "8 Ball", needsText: true, resultChannelOptional: true, note: "Answers a question with a fun 8-ball response." },
          { id: "poll", label: "Quick Poll", needsChannel: true, needsText: true, note: "Creates a quick poll. Use: Question | Option 1 | Option 2 | Option 3" },
          { id: "joke", label: "Joke", resultChannelOptional: true, note: "Sends a quick joke." },
          { id: "quote", label: "Quote", resultChannelOptional: true, note: "Sends a clean quote." },
          { id: "rps", label: "Rock Paper Scissors", needsText: true, resultChannelOptional: true, note: "Type rock, paper, or scissors." },
          { id: "trivia", label: "Trivia", resultChannelOptional: true, note: "Sends a simple trivia question." },
          { id: "roast", label: "Light Roast", needsUser: true, resultChannelOptional: true, note: "Sends a playful, safe roast for the selected user." },
          { id: "define", label: "Define Text", needsText: true, resultChannelOptional: true, note: "Creates a simple definition-style response." },
          { id: "weather", label: "Weather Note", needsText: true, resultChannelOptional: true, note: "Sends a weather request note. Use the live command for actual weather if configured." },
        ],
      },
    ];
  }

  function flattenCommandCatalog(catalog) {
    return catalog.flatMap((category) =>
      category.actions.map((action) => ({
        ...action,
        categoryId: category.id,
        categoryLabel: category.label,
        categoryIcon: category.icon,
      }))
    );
  }

  function parseUserIds(raw) {
    return String(raw || "")
      .split(/[\s,]+/)
      .map((id) => id.trim().replace(/[<@!>]/g, ""))
      .filter(Boolean)
      .slice(0, 20);
  }

  function humanUser(memberOrUser) {
    if (!memberOrUser) return "Unknown";
    const user = memberOrUser.user || memberOrUser;
    return `${user.username || "Unknown"}${user.discriminator && user.discriminator !== "0" ? `#${user.discriminator}` : ""}`;
  }

  function canModerateTarget(guild, member) {
    if (!member) return { ok: false, reason: "Member not found in selected server" };
    if (member.id === guild.ownerId) return { ok: false, reason: "Cannot moderate the server owner" };
    if (member.id === client.user.id) return { ok: false, reason: "Cannot moderate the bot itself" };
    const botMember = guild.members.me;
    if (botMember && member.roles.highest.position >= botMember.roles.highest.position) {
      return { ok: false, reason: "Bot role is not high enough to manage this member" };
    }
    return { ok: true };
  }

  async function getAdminVoiceChannels(guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return [];
    await guild.channels.fetch().catch(() => null);
    return [...guild.channels.cache.values()]
      .filter((ch) => ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice)
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .map((ch) => ({ id: ch.id, name: ch.name }));
  }

  async function getAdminRoles(guildId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return [];
    await guild.roles.fetch().catch(() => null);
    return [...guild.roles.cache.values()]
      .filter((role) => role.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({ id: role.id, name: role.name, color: role.hexColor, position: role.position }));
  }

  async function searchGuildMembers(guild, query = "") {
    const q = String(query || "").trim().toLowerCase();
    await guild.members.fetch({ limit: 100 }).catch(() => null);
    const members = [...guild.members.cache.values()]
      .filter((member) => !member.user.bot)
      .filter((member) => {
        if (!q) return true;
        return (
          member.id.includes(q) ||
          member.user.username.toLowerCase().includes(q) ||
          member.displayName.toLowerCase().includes(q) ||
          humanUser(member).toLowerCase().includes(q)
        );
      })
      .slice(0, 25)
      .map((member) => ({
        id: member.id,
        username: humanUser(member),
        displayName: member.displayName,
        avatar: member.user.displayAvatarURL({ extension: "png", size: 64, forceStatic: false }),
      }));
    return members;
  }

  function requireSelectedGuild(req, res, next) {
    const selectedGuildId = req.session.selectedGuildId;

    if (!selectedGuildId) {
      return req.session?.loginRole === "customer"
        ? res.redirect(customerServersPath(req))
        : res.redirect("/select-server");
    }

    const guild = client.guilds.cache.get(selectedGuildId);

    if (!guild) {
      req.session.selectedGuildId = null;
      return req.session?.loginRole === "customer"
        ? res.redirect(`${customerServersPath(req)}?error=Bot is no longer installed in that server`)
        : res.redirect("/select-server");
    }

    if (req.session?.loginRole === "customer" && !customerCanManageGuild(req, selectedGuildId)) {
      req.session.selectedGuildId = null;
      return res.redirect(`${customerServersPath(req)}?error=You do not have permission to manage that server`);
    }

    return next();
  }

  function getSelectedGuild(req) {
    const selectedGuildId = req.session.selectedGuildId;
    if (!selectedGuildId) return null;
    return client.guilds.cache.get(selectedGuildId) || null;
  }

  function getBotAvatar() {
    return (
      client.user?.displayAvatarURL({
        extension: "png",
        size: 256,
        forceStatic: false,
      }) || ""
    );
  }

  async function getOfficialBotBanner() {
    try {
      if (!client.user) return "";

      const fetchedUser = await client.user.fetch(true);

      const officialBanner = fetchedUser.bannerURL({
        extension: "png",
        size: 1024,
      });

      if (officialBanner) return officialBanner;

      if (process.env.DASHBOARD_BANNER_URL) {
        return process.env.DASHBOARD_BANNER_URL;
      }

      return "";
    } catch (err) {
      console.log("⚠️ Could not fetch official bot banner, using fallback.");

      if (process.env.DASHBOARD_BANNER_URL) {
        return process.env.DASHBOARD_BANNER_URL;
      }

      return "";
    }
  }

  function getGuildIcon(req) {
    const guild = getSelectedGuild(req);

    return (
      guild?.iconURL({
        extension: "png",
        size: 256,
        forceStatic: false,
      }) || getBotAvatar()
    );
  }

  function getGuildName(req) {
    const guild = getSelectedGuild(req);
    return guild?.name || "No Server Selected";
  }

  function getGuildId(req) {
    const guild = getSelectedGuild(req);
    return guild?.id || "unknown";
  }

  function getGuildMemberCount(req) {
    const guild = getSelectedGuild(req);
    return guild?.memberCount || 0;
  }

  function formatUptime(ms) {
    const totalSeconds = Math.floor((ms || 0) / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function getDashboardStats(req) {
    return {
      status: client.isReady() ? "Online" : "Offline",
      guildCount: client.guilds.cache.size,
      commandCount: client.commands?.size || 0,
      uptime: formatUptime(client.uptime || 0),
      selectedMembers: getGuildMemberCount(req),
    };
  }

  async function getGuildPlan(guild) {
    if (!guild) return null;

    let plan = await modelFindOneSafe(GuildPlan, { guildId: guild.id }).catch(() => null);

    if (!plan) {
      plan = await GuildPlan.create({
        guildId: guild.id,
        guildName: guild.name,
        plan: "free",
        premiumEnabled: false,
      }).catch(() => null);
    } else if (plan.guildName !== guild.name) {
      plan.guildName = guild.name;
      await plan.save().catch(() => null);
    }

    return plan;
  }

  async function isGuildPremium(guildId) {
    if (!guildId) return false;
    const plan = await modelFindOneSafe(GuildPlan, { guildId }).catch(() => null);
    return Boolean(plan && plan.premiumEnabled);
  }

  async function getUnlockedModuleKeys(guildId) {
    if (!guildId) return new Set();

    const docs = await modelFindSafe(GuildModuleUnlock, { guildId, enabled: true }).catch(() => []);
    return new Set((docs || []).map((doc) => String(doc.moduleKey || "")));
  }

  async function isGuildModuleAccessible(guildId, moduleKey) {
    const cleanKey = String(moduleKey || "").trim();

    if (!PREMIUM_MODULE_KEYS.has(cleanKey)) return true;
    if (await isGuildPremium(guildId)) return true;

    const unlock = await modelFindOneSafe(GuildModuleUnlock, {
      guildId,
      moduleKey: cleanKey,
      enabled: true,
    }).catch(() => null);

    return Boolean(unlock);
  }

  async function getSupportConfig(guild) {
    const guildId = guild?.id || "global";
    const guildName = guild?.name || "Global";

    let config = await modelFindOneSafe(DashboardSupportConfig, { guildId }).catch(() => null);

    if (!config) {
      config = await DashboardSupportConfig.create({
        guildId,
        guildName,
        supportTitle: "Need help unlocking Premium?",
        supportDescription:
          "Contact support to unlock this module for your server. You can also DM a support member.",
        supportInviteUrl: "",
        supportButtonText: "Click here to contact support",
        supportFooterNote: "Tell support which server and module you want to unlock.",
        supportUsers: [],
      }).catch(() => null);
    } else if (config.guildName !== guildName) {
      config.guildName = guildName;
      await config.save().catch(() => null);
    }

    return config;
  }


  async function getServerList() {
    const guilds = [...client.guilds.cache.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const servers = [];

    for (const guild of guilds) {
      const plan = await getGuildPlan(guild);

      servers.push({
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount || 0,
        premiumEnabled: Boolean(plan?.premiumEnabled),
        plan: plan?.premiumEnabled ? "premium" : "free",
        icon:
          guild.iconURL({
            extension: "png",
            size: 256,
            forceStatic: false,
          }) || getBotAvatar(),
      });
    }

    return servers;
  }


  function getDiscordAvatarUrl(user, size = 128) {
    if (!user) return getBotAvatar();

    if (user.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=${size}`;
    }

    const index = Number(user.discriminator || 0) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }

  function hasCustomerManagePermission(guildLike) {
    const permissions = BigInt(guildLike?.permissions || 0);
    const administrator = 0x0000000000000008n;
    const manageGuild = 0x0000000000000020n;

    return Boolean((permissions & administrator) === administrator || (permissions & manageGuild) === manageGuild);
  }

  function customerCanManageGuild(req, guildId) {
    const guilds = req.session?.discordGuilds || [];
    const found = guilds.find((guild) => String(guild.id) === String(guildId));
    return Boolean(found && hasCustomerManagePermission(found));
  }

  function getBotInviteUrl(guildId = "") {
    const clientId = DISCORD_CLIENT_ID || client.user?.id || "";
    const params = new URLSearchParams({
      client_id: clientId,
      scope: "bot applications.commands",
      permissions: "8",
    });

    if (guildId) {
      params.set("guild_id", guildId);
      params.set("disable_guild_select", "true");
    }

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }

  async function fetchDiscordJson(url, token) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Discord API failed: ${response.status} ${text.slice(0, 200)}`);
    }

    return response.json();
  }

  async function exchangeDiscordCode(code) {
    const body = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    });

    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Discord token exchange failed: ${response.status} ${text.slice(0, 250)}`);
    }

    return response.json();
  }

  async function saveCustomerAccount(user, guilds = []) {
    if (!user?.id) return null;

    const manageableGuilds = (guilds || [])
      .filter((guild) => hasCustomerManagePermission(guild))
      .map((guild) => ({
        guildId: guild.id,
        guildName: guild.name,
        icon: guild.icon || "",
        owner: Boolean(guild.owner),
        permissions: String(guild.permissions || "0"),
      }));

    return CustomerAccount.findOneAndUpdate(
      { discordUserId: user.id },
      {
        $set: {
          discordUserId: user.id,
          username: user.username || "",
          globalName: user.global_name || "",
          discriminator: user.discriminator || "",
          avatar: user.avatar || "",
          avatarUrl: getDiscordAvatarUrl(user),
          manageableGuilds,
          lastLoginAt: new Date(),
        },
      },
      { upsert: true, new: true }
    ).catch((err) => {
      console.error("[Customer Account Save Error]", err);
      return null;
    });
  }

  async function buildCustomerServerCards(req) {
    const discordGuilds = req.session?.discordGuilds || [];
    const cards = [];

    for (const guildLike of discordGuilds) {
      const canManage = hasCustomerManagePermission(guildLike);
      const botGuild = client.guilds.cache.get(guildLike.id);
      const installed = Boolean(botGuild);
      const plan = installed ? await getGuildPlan(botGuild) : null;

      let icon = getBotAvatar();
      if (guildLike.icon) {
        icon = `https://cdn.discordapp.com/icons/${guildLike.id}/${guildLike.icon}.png?size=128`;
      } else if (botGuild) {
        icon = botGuild.iconURL({ extension: "png", size: 128, forceStatic: false }) || getBotAvatar();
      }

      cards.push({
        id: guildLike.id,
        name: guildLike.name,
        icon,
        canManage,
        installed,
        premiumEnabled: Boolean(plan?.premiumEnabled),
        status: installed && canManage ? "manage" : canManage ? "invite" : "no-permission",
        inviteUrl: getBotInviteUrl(guildLike.id),
        memberCount: botGuild?.memberCount || 0,
      });
    }

    return cards.sort((a, b) => {
      const order = { manage: 0, invite: 1, "no-permission": 2 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.name.localeCompare(b.name);
    });
  }

  function requireDiscordAuth(req, res, next) {
    if (req.session?.discordUser?.id && Array.isArray(req.session?.discordGuilds)) return next();
    return dashboardJsonOrRedirect(req, res, "/customer", { ok: false, message: "Please login with Discord first" });
  }

  function customerBasePath(req) {
    const userId = req.session?.discordUser?.id || "me";
    return `/customer/${userId}`;
  }

  function customerServersPath(req) {
    return `${customerBasePath(req)}/servers`;
  }

  function customerServerPath(req, guildId, page = "dashboard") {
    return `${customerBasePath(req)}/server/${guildId}/${page}`;
  }

  function validLastCustomerGuild(req) {
    // Only use the remembered customer guild, not selectedGuildId.
    // selectedGuildId can come from old sessions and create redirect loops.
    const guildId = String(req.session?.lastCustomerGuildId || "");
    if (!guildId) return null;

    const botGuild = client.guilds.cache.get(guildId);
    if (!botGuild) return null;

    if (!customerCanManageGuild(req, guildId)) return null;

    return guildId;
  }

  function rememberAfterDiscordLogin(req, nextPath = "/app") {
    req.session.afterDiscordLogin = nextPath;
  }


  function requireCustomerUrlOwner(req, res, next) {
    const sessionUserId = String(req.session?.discordUser?.id || "");
    const urlUserId = String(req.params.userId || "");

    if (!sessionUserId) {
      return dashboardJsonOrRedirect(req, res, "/customer", { ok: false, message: "Please login with Discord first" });
    }

    if (urlUserId !== sessionUserId) {
      return res.redirect(`${customerBasePath(req)}/servers?error=That customer page does not belong to your Discord account`);
    }

    return next();
  }


  function buildPremiumNavSections(isPremium, mode = "owner", guildId = "", userId = "", unlockedModuleKeys = new Set()) {
    const isCustomerMode = mode === "customer";
    const safeGuildId = String(guildId || "");

    function scopedHref(item) {
      const raw = item.href || "/dashboard";

      if (!safeGuildId) return raw;

      if (isCustomerMode) {
        const safeUserId = String(userId || "me");
        const customerBase = `/customer/${safeUserId}/server/${safeGuildId}`;

        if (item.key === "owner-command-center") return "";
        if (raw === "/dashboard") return `${customerBase}/dashboard`;
        if (raw === "/settings") return `${customerBase}/settings`;
        if (raw === "/premium-required") return `${customerBase}/premium-required`;
        return `${customerBase}${raw}`;
      }

      if (raw === "/dashboard") return `/owner/${safeGuildId}/dashboard`;
      if (raw === "/settings") return `/owner/${safeGuildId}/settings`;
      if (raw === "/owner-command-center") return `/owner/${safeGuildId}/command-center`;
      if (raw === "/premium-control") return `/owner/${safeGuildId}/premium-control`;
      if (raw === "/premium-required") return `/owner/${safeGuildId}/premium-required`;
      return `/owner/${safeGuildId}${raw}`;
    }

    return navSections.map((section) => {
      const items = section.items
        .filter((item) => {
          if (!isCustomerMode) return true;

          const itemKey = String(item.key || "");
          const itemHref = String(item.href || "");
          const itemBadge = String(item.badge || "").toLowerCase();

          // Customers must never see owner-only controls in the sidebar.
          if (itemKey === "settings") return false;
          if (itemKey === "owner-command-center") return false;
          if (itemKey === "premium-control") return false;
          if (itemHref.includes("settings")) return false;
          if (itemHref.includes("owner-command-center")) return false;
          if (itemHref.includes("premium-control")) return false;
          if (itemBadge === "owner") return false;

          return true;
        })
        .map((item) => {
          const moduleUnlocked = Boolean(isPremium || unlockedModuleKeys.has(item.key));
          const premiumLocked = PREMIUM_MODULE_KEYS.has(item.key) && !moduleUnlocked;
          const href = scopedHref(item);

          if (!premiumLocked) {
            return { ...item, href, locked: false };
          }

          const requiredPath = isCustomerMode
            ? `/customer/${String(userId || "me")}/server/${safeGuildId}/premium-required?module=${encodeURIComponent(item.label)}`
            : `/owner/${safeGuildId}/premium-required?module=${encodeURIComponent(item.label)}`;

          return {
            ...item,
            href: requiredPath,
            locked: true,
            badge: isCustomerMode ? "🔒" : "Premium",
            desc:
              isCustomerMode
                ? `${item.label} is locked for this server. Contact support to unlock it, or DM a support member from the support page.`
                : `${item.label} is locked. Enable full server Premium or unlock only this module from Premium Control.`,
          };
        });

      return { ...section, items };
    });
  }


  function buildPremiumPluginCards(cards, isPremium, mode = "owner", routeBase = "", unlockedModuleKeys = new Set()) {
    return (cards || [])
      .map((card) => {
        const key = (card.key || String(card.href || "").replace(/^\//, "").split("?")[0]).trim();

        // Customers should not see the Settings card at all.
        if (mode === "customer" && key === "settings") return null;

        const moduleUnlocked = Boolean(isPremium || unlockedModuleKeys.has(key));
        const premiumLocked = PREMIUM_MODULE_KEYS.has(key) && !moduleUnlocked;

        const base = String(routeBase || "");
        const normalHref = base && card.href?.startsWith("/") ? `${base}${card.href}` : card.href;

        if (!premiumLocked) {
          return {
            ...card,
            key,
            href: normalHref,
            locked: false,
            status: card.status || "Live",
          };
        }

        return {
          ...card,
          key,
          locked: true,
          status: "Locked",
          href: `${base || ""}/premium-required?module=${encodeURIComponent(card.title || key)}&moduleKey=${encodeURIComponent(key)}`,
          desc:
            mode === "customer"
              ? `${card.title || "This module"} is locked for this server. Contact support to unlock it, or DM a support member.`
              : `${card.title || "This module"} is locked. Enable full server Premium or unlock only this module from Premium Control.`,
        };
      })
      .filter(Boolean);
  }

  function isPremiumRoute(req) {
    return PREMIUM_ROUTE_PREFIXES.some((prefix) => {
      return req.path === prefix || req.path.startsWith(`${prefix}/`);
    });
  }

  async function getChannelGroups(req) {
    const guild = getSelectedGuild(req);
    if (!guild) return [];

    await guild.channels.fetch().catch(() => null);

    const allChannels = [...guild.channels.cache.values()];

    const categories = allChannels
      .filter((ch) => ch.type === ChannelType.GuildCategory)
      .sort((a, b) => a.rawPosition - b.rawPosition);

    const textChannels = allChannels
      .filter(
        (ch) =>
          ch.type === ChannelType.GuildText ||
          ch.type === ChannelType.GuildAnnouncement
      )
      .sort((a, b) => a.rawPosition - b.rawPosition);

    const groups = [];

    const noCategoryChannels = textChannels
      .filter((ch) => !ch.parentId)
      .map((ch) => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        position: ch.rawPosition,
      }));

    if (noCategoryChannels.length) {
      groups.push({
        id: "no-category",
        name: "No Category",
        channels: noCategoryChannels,
      });
    }

    for (const category of categories) {
      const categoryChannels = textChannels
        .filter((ch) => ch.parentId === category.id)
        .map((ch) => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          position: ch.rawPosition,
        }));

      if (categoryChannels.length) {
        groups.push({
          id: category.id,
          name: category.name,
          channels: categoryChannels,
        });
      }
    }

    return groups;
  }

  async function buildViewData(req, currentPage, extra = {}) {
    const botBanner = await getOfficialBotBanner();
    const selectedGuild = getSelectedGuild(req);
    const selectedGuildPlan = selectedGuild ? await getGuildPlan(selectedGuild) : null;
    const premiumEnabled = Boolean(selectedGuildPlan?.premiumEnabled);
    const unlockedModuleKeys = selectedGuild ? await getUnlockedModuleKeys(selectedGuild.id) : new Set();
    const supportConfig = selectedGuild ? await getSupportConfig(selectedGuild) : null;

    return {
      botName: client.user?.username || "Legendary Bot",
      botAvatar: getBotAvatar(),
      botBanner,
      guildName: getGuildName(req),
      guildIcon: getGuildIcon(req),
      guildId: getGuildId(req),
      guildMemberCount: getGuildMemberCount(req),
      dashboardVersion: DASHBOARD_VERSION,
      dashboardMode: req.session?.loginRole === "customer" ? "customer" : "owner",
      routeBase:
        req.session?.loginRole === "customer" && selectedGuild
          ? customerServerPath(req, selectedGuild.id, "").replace(/\/$/, "")
          : selectedGuild
            ? `/owner/${selectedGuild.id}`
            : "",
      canManagePremium: req.session?.loginRole !== "customer",
      navSections: buildPremiumNavSections(
        premiumEnabled,
        req.session?.loginRole === "customer" ? "customer" : "owner",
        selectedGuild?.id || "",
        req.session?.discordUser?.id || "",
        unlockedModuleKeys
      ),
      currentPage,
      stats: getDashboardStats(req),
      selectedGuildPlan,
      premiumEnabled,
      unlockedModuleKeys,
      supportConfig,
      supportHref:
        req.session?.loginRole === "customer" && selectedGuild
          ? `${customerServerPath(req, selectedGuild.id, "support")}`
          : selectedGuild
            ? `/owner/${selectedGuild.id}/support`
            : "/support",
      premiumControlHref:
        selectedGuild ? `/owner/${selectedGuild.id}/premium-control` : "/premium-control",
      ...extra,
    };
  }

  async function saveEmbedTemplateFromRequest(req, options = {}) {
    const guildId = getGuildId(req);

    const {
      name,
      category,
      sourceModule,
      sourceLabel,
      templateType,
      content,
      embedTitle,
      embedDescription,
      embedColor,
      embedFooter,
      embedImage,
      embedThumbnail,
    } = options;

    const hasAnything =
      (content || "").trim() ||
      (embedTitle || "").trim() ||
      (embedDescription || "").trim() ||
      (embedFooter || "").trim() ||
      (embedImage || "").trim() ||
      (embedThumbnail || "").trim();

    if (!hasAnything) return null;

    return DashboardEmbedTemplate.create({
      guildId,
      name: name?.trim() || "Untitled Template",
      category: category?.trim() || "General",
      sourceModule: sourceModule || "unknown",
      sourceLabel: sourceLabel || "Built from Dashboard",
      templateType: templateType || "embed",
      content: content?.trim() || "",
      embedTitle: embedTitle?.trim() || "",
      embedDescription: embedDescription?.trim() || "",
      embedColor: embedColor?.trim() || "#8b5cf6",
      embedFooter: embedFooter?.trim() || "",
      embedImage: embedImage?.trim() || "",
      embedThumbnail: embedThumbnail?.trim() || "",
      enabled: true,
    });
  }

  function replaceWelcomeGoodbyeVarsForDashboard(text, guild, user) {
  return String(text || "")
    .replaceAll("{user}", `<@${user.id}>`)
    .replaceAll("{username}", user.username || "TestUser")
    .replaceAll("{server}", guild.name || "this server")
    .replaceAll("{memberCount}", String(guild.memberCount || 0));
}

function makeWelcomeGoodbyeEmbed(settings, guild, user, type) {
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

  const cleanColor = /^#[0-9A-Fa-f]{6}$/.test(String(color || "").trim())
    ? String(color).trim()
    : isWelcome
      ? "#8b5cf6"
      : "#ff6b6b";

  const embed = new EmbedBuilder()
    .setColor(cleanColor)
    .setTimestamp();

  if (title?.trim()) {
    embed.setTitle(replaceWelcomeGoodbyeVarsForDashboard(title, guild, user));
  }

  if (description?.trim()) {
    embed.setDescription(replaceWelcomeGoodbyeVarsForDashboard(description, guild, user));
  }

  if (footer?.trim()) {
    embed.setFooter({
      text: replaceWelcomeGoodbyeVarsForDashboard(footer, guild, user),
    });
  }

  if (thumbnail?.trim()) {
    embed.setThumbnail(replaceWelcomeGoodbyeVarsForDashboard(thumbnail, guild, user));
  }

  if (image?.trim()) {
    embed.setImage(replaceWelcomeGoodbyeVarsForDashboard(image, guild, user));
  }

  return embed;
}

async function sendWelcomeGoodbyeTest(req, type) {
  const guild = getSelectedGuild(req);
  const guildId = getGuildId(req);

  if (!guild) {
    return { ok: false, reason: "No server selected" };
  }

  const settings = await modelFindOneSafe(DashboardWelcomeGoodbye, { guildId });

  if (!settings) {
    return { ok: false, reason: "Welcome goodbye settings not found" };
  }

  const isWelcome = type === "welcome";

  const channelId = isWelcome
    ? settings.welcomeChannelId
    : settings.goodbyeChannelId;

  if (!channelId) {
    return { ok: false, reason: `Please select a ${type} channel first` };
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);

  if (!channel || channel.guildId !== guildId) {
    return { ok: false, reason: `Saved ${type} channel was not found` };
  }

  const user = client.user;

  const normalContent = isWelcome
    ? settings.welcomeContent
    : settings.goodbyeContent;

  const embedEnabled = isWelcome
    ? settings.welcomeEmbedEnabled !== false
    : settings.goodbyeEmbedEnabled !== false;

  const payload = {};

  if (normalContent?.trim()) {
    payload.content = replaceWelcomeGoodbyeVarsForDashboard(normalContent, guild, user);
  }

  if (embedEnabled) {
    payload.embeds = [makeWelcomeGoodbyeEmbed(settings, guild, user, type)];
  }

  if (!payload.content && !payload.embeds) {
    return { ok: false, reason: "Nothing to send" };
  }

  await channel.send(payload);

  return { ok: true };
}

  function getDashboardErrorMessage(err, fallback = "Something went wrong") {
  if (!err) return fallback;

  const raw =
    err?.message ||
    err?.reason ||
    err?.toString?.() ||
    fallback;

  return String(raw)
    .replaceAll(process.env.DISCORD_TOKEN || "___NO_TOKEN___", "[hidden token]")
    .replaceAll(process.env.MONGODB_URI || "___NO_MONGO___", "[hidden mongo uri]")
    .replaceAll(process.env.DASHBOARD_PASSWORD || "___NO_PASSWORD___", "[hidden password]")
    .slice(0, 500);
}

function redirectWithDashboardError(res, path, fallback, err) {
  const detail = getDashboardErrorMessage(err, fallback);
  return res.redirect(`${path}?error=${encodeURIComponent(`${fallback} — ${detail}`)}`);
}

function isDashboardAjaxRequest(req) {
  const accept = String(req.headers.accept || "");
  const requestedWith = String(req.headers["x-requested-with"] || "");
  return requestedWith.toLowerCase() === "xmlhttprequest" || accept.includes("application/json");
}

function sendDashboardSuccess(req, res, fallbackPath, message, extra = {}) {
  if (isDashboardAjaxRequest(req)) {
    return res.json({
      ...extra,
      ok: true,
      message,
      redirect: extra.redirect || null,
      countdownMs: extra.countdownMs || 4500,
    });
  }

  return res.redirect(`${fallbackPath}?success=${encodeURIComponent(message)}`);
}

function sendDashboardError(req, res, fallbackPath, fallback, err, statusCode = 400) {
  const detail = getDashboardErrorMessage(err, fallback);
  const message = detail && detail !== fallback ? `${fallback} — ${detail}` : fallback;

  if (isDashboardAjaxRequest(req)) {
    return res.status(statusCode).json({
      ok: false,
      message,
      error: message,
      countdownMs: 8000,
    });
  }

  return res.redirect(`${fallbackPath}?error=${encodeURIComponent(message)}`);
}


  function cleanDashboardHex(value, fallback = "#8b5cf6") {
  const color = String(value || "").trim();
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : fallback;
}

function dashboardButtonStyle(styleName) {
  const styles = {
    Primary: ButtonStyle.Primary,
    Secondary: ButtonStyle.Secondary,
    Success: ButtonStyle.Success,
    Danger: ButtonStyle.Danger,
  };

  return styles[styleName] || ButtonStyle.Secondary;
}

function buildReactionRolePanelPayload(panel) {
  const payload = {};

  if (panel.content?.trim()) {
    payload.content = panel.content.trim();
  }

  if (panel.embedEnabled !== false) {
    const embed = new EmbedBuilder()
      .setTitle(panel.title || "Reaction Roles")
      .setDescription(panel.description || "Click a button below to get or remove a role.")
      .setColor(cleanDashboardHex(panel.color, "#8b5cf6"))
      .setTimestamp();

    if (panel.footer?.trim()) {
      embed.setFooter({ text: panel.footer.trim() });
    }

    if (panel.thumbnail?.trim()) {
      embed.setThumbnail(panel.thumbnail.trim());
    }

    if (panel.image?.trim()) {
      embed.setImage(panel.image.trim());
    }

    payload.embeds = [embed];
  }

  const rows = [];
  const buttons = (panel.buttons || []).slice(0, 25);

  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder();

    buttons.slice(i, i + 5).forEach((button, localIndex) => {
      const realIndex = i + localIndex;

      const btn = new ButtonBuilder()
        .setCustomId(`rr_${panel._id}_${realIndex}`)
        .setLabel(button.label || button.roleName || "Role")
        .setStyle(dashboardButtonStyle(button.style));

      if (button.emoji?.trim()) {
        btn.setEmoji(button.emoji.trim());
      }

      row.addComponents(btn);
    });

    if (row.components.length) rows.push(row);
  }

  if (rows.length) {
    payload.components = rows;
  }

  return payload;
}

async function parseReactionRoleButtonsFromRequest(req) {
  const guild = getSelectedGuild(req);

  if (!guild) return [];

  await guild.roles.fetch().catch(() => null);

  let rawButtons = [];

  try {
    rawButtons = JSON.parse(req.body.buttonsJson || "[]");
  } catch {
    rawButtons = [];
  }

  if (!Array.isArray(rawButtons)) rawButtons = [];

  const buttons = [];

  for (const item of rawButtons.slice(0, 25)) {
    if (!item.roleId) continue;

    const role = guild.roles.cache.get(String(item.roleId));

    if (!role) continue;

    buttons.push({
      label: String(item.label || "").trim() || role.name,
      emoji: String(item.emoji || "").trim(),
      roleId: role.id,
      roleName: role.name,
      style: ["Primary", "Secondary", "Success", "Danger"].includes(item.style)
        ? item.style
        : "Secondary",
    });
  }

  return buttons;
}


  async function getGuildCategories(req) {
    const guild = getSelectedGuild(req);
    if (!guild) return [];

    return guild.channels.cache
      .filter((channel) => channel.type === 4 || channel.type === "GuildCategory")
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        position: channel.rawPosition ?? channel.position ?? 0,
      }))
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }


async function getAllGuildSelectableChannels(req) {
  const guild = getSelectedGuild(req);
  if (!guild) return [];

  await guild.channels.fetch().catch(() => null);

  const allowedTypes = new Set([
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
    0,
    5,
    15,
    "GuildText",
    "GuildAnnouncement",
    "GuildForum",
  ]);

  const categories = [...guild.channels.cache.values()]
    .filter((channel) => channel.type === ChannelType.GuildCategory || channel.type === 4 || channel.type === "GuildCategory")
    .map((category) => ({
      id: category.id,
      name: category.name,
      position: category.rawPosition ?? category.position ?? 0,
      channels: [],
    }))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  const uncategorized = {
    id: "no-category",
    name: "No Category",
    position: 999999,
    channels: [],
  };

  [...guild.channels.cache.values()]
    .filter((channel) => allowedTypes.has(channel.type))
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      parentId: channel.parentId || "no-category",
      position: channel.rawPosition ?? channel.position ?? 0,
      type: channel.type,
    }))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .forEach((channel) => {
      const parent = categoryMap.get(channel.parentId) || uncategorized;
      parent.channels.push(channel);
    });

  const finalGroups = [...categories];
  if (uncategorized.channels.length) finalGroups.push(uncategorized);

  return finalGroups;
}

async function getGuildRoles(req) {
  const guild = getSelectedGuild(req);
  if (!guild) return [];

  await guild.roles.fetch().catch(() => null);

  return [...guild.roles.cache.values()]
    .filter((role) => role.name !== "@everyone")
    .sort((a, b) => b.position - a.position)
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.hexColor,
      position: role.position,
      managed: role.managed,
    }));
}

async function parseLevelRewardsFromRequest(req) {
  const guild = getSelectedGuild(req);

  if (!guild) return [];

  await guild.roles.fetch().catch(() => null);

  let rawRewards = [];

  try {
    rawRewards = JSON.parse(req.body.rewardsJson || "[]");
  } catch {
    rawRewards = [];
  }

  if (!Array.isArray(rawRewards)) rawRewards = [];

  const rewards = [];

  for (const item of rawRewards.slice(0, 25)) {
    const level = Number(item.level);
    const roleId = String(item.roleId || "");

    if (!level || level < 1 || !roleId) continue;

    const role = guild.roles.cache.get(roleId);

    if (!role) continue;

    rewards.push({
      level,
      roleId: role.id,
      roleName: role.name,
    });
  }

  return rewards.sort((a, b) => a.level - b.level);
}

async function parseIgnoredChannelsFromRequest(req) {
  const guild = getSelectedGuild(req);

  if (!guild) return [];

  let rawChannels = [];

  try {
    rawChannels = JSON.parse(req.body.ignoredChannelsJson || "[]");
  } catch {
    rawChannels = [];
  }

  if (!Array.isArray(rawChannels)) rawChannels = [];

  const ignoredChannels = [];

  for (const item of rawChannels.slice(0, 50)) {
    const channelId = String(item.channelId || "");
    if (!channelId) continue;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.guildId !== guild.id) continue;

    ignoredChannels.push({
      channelId: channel.id,
      channelName: channel.name || "",
    });
  }

  return ignoredChannels;
}

async function parseNoXpRolesFromRequest(req) {
  const guild = getSelectedGuild(req);

  if (!guild) return [];

  await guild.roles.fetch().catch(() => null);

  let rawRoles = [];

  try {
    rawRoles = JSON.parse(req.body.noXpRolesJson || "[]");
  } catch {
    rawRoles = [];
  }

  if (!Array.isArray(rawRoles)) rawRoles = [];

  const noXpRoles = [];

  for (const item of rawRoles.slice(0, 50)) {
    const roleId = String(item.roleId || "");
    if (!roleId) continue;

    const role = guild.roles.cache.get(roleId);
    if (!role) continue;

    noXpRoles.push({
      roleId: role.id,
      roleName: role.name,
    });
  }

  return noXpRoles;
}

async function parseMultiplierRolesFromRequest(req) {
  const guild = getSelectedGuild(req);

  if (!guild) return [];

  await guild.roles.fetch().catch(() => null);

  let rawRoles = [];

  try {
    rawRoles = JSON.parse(req.body.multiplierRolesJson || "[]");
  } catch {
    rawRoles = [];
  }

  if (!Array.isArray(rawRoles)) rawRoles = [];

  const multiplierRoles = [];

  for (const item of rawRoles.slice(0, 25)) {
    const roleId = String(item.roleId || "");
    const multiplier = Math.max(1, Math.min(10, Number(item.multiplier || 1)));

    if (!roleId) continue;

    const role = guild.roles.cache.get(roleId);
    if (!role) continue;

    multiplierRoles.push({
      roleId: role.id,
      roleName: role.name,
      multiplier,
    });
  }

  return multiplierRoles;
}

function calculateDashboardLevelFromXp(xp) {
  return Math.floor(0.1 * Math.sqrt(Number(xp || 0)));
}

function xpNeededForDashboardLevel(level) {
  return Math.pow(Number(level || 0) / 0.1, 2);
}

async function resolveDashboardMember(guild, userInput) {
  const clean = String(userInput || "")
    .trim()
    .replace(/[<@!>]/g, "");

  if (!clean) return null;

  const member = await guild.members.fetch(clean).catch(() => null);
  if (member) return member;

  const lowered = clean.toLowerCase();

  await guild.members.fetch().catch(() => null);

  return (
    guild.members.cache.find((m) =>
      m.user.username.toLowerCase() === lowered ||
      m.displayName.toLowerCase() === lowered ||
      `${m.user.username}#${m.user.discriminator}`.toLowerCase() === lowered
    ) || null
  );
}

async function getDashboardModuleConfig(guildId, moduleKey, defaults = {}) {
  let doc = await modelFindOneSafe(DashboardModuleConfig, { guildId, moduleKey });

  if (!doc) {
    doc = await DashboardModuleConfig.create({ guildId, moduleKey, settings: defaults });
  }

  return doc;
}

async function saveDashboardModuleConfig(guildId, moduleKey, settings = {}) {
  return DashboardModuleConfig.findOneAndUpdate(
    { guildId, moduleKey },
    { $set: { settings } },
    { upsert: true, new: true }
  );
}

function moduleSetting(doc, key, fallback = "") {
  return doc?.settings?.[key] ?? fallback;
}

function cleanDashboardNumber(value, fallback = 1, min = 0, max = 999999) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

  function makeEmbedFromAutoMessage(job) {
    const hasEmbed =
      job.embedTitle ||
      job.embedDescription ||
      job.embedFooter ||
      job.embedImage ||
      job.embedThumbnail;

    if (!hasEmbed) return null;

    const embed = new EmbedBuilder().setColor(job.embedColor || "#8b5cf6");

    if (job.embedTitle) embed.setTitle(job.embedTitle);
    if (job.embedDescription) embed.setDescription(job.embedDescription);
    if (job.embedFooter) embed.setFooter({ text: job.embedFooter });
    if (job.embedImage) embed.setImage(job.embedImage);
    if (job.embedThumbnail) embed.setThumbnail(job.embedThumbnail);

    return embed;
  }

  async function sendAutoMessage(job) {
    try {
      const channel = await client.channels.fetch(job.channelId).catch(() => null);
      if (!channel) return;

      const payload = {};
      if (job.content?.trim()) payload.content = job.content.trim();

      const embed = makeEmbedFromAutoMessage(job);
      if (embed) payload.embeds = [embed];

      if (!payload.content && !payload.embeds) return;

      await channel.send(payload);

      job.lastSentAt = new Date();
      await job.save();
    } catch (err) {
      console.error("[Dashboard Auto Message Send Error]", err);
    }
  }

  function stopAutoMessageJob(id) {
    if (autoMessageIntervals.has(id)) {
      clearInterval(autoMessageIntervals.get(id));
      autoMessageIntervals.delete(id);
    }
  }

  function startAutoMessageJob(job) {
    stopAutoMessageJob(String(job._id));

    if (!job.active) return;

    const intervalMs = Math.max(1, Number(job.intervalHours || 12)) * 60 * 60 * 1000;

    const interval = setInterval(() => {
      sendAutoMessage(job).catch((err) => {
        console.error("[Dashboard Auto Message Interval Error]", err);
      });
    }, intervalMs);

    autoMessageIntervals.set(String(job._id), interval);
  }

  async function restoreDashboardAutoMessages() {
    const jobs = await modelFindSafe(DashboardAutoMessage, { active: true });
    for (const job of jobs) startAutoMessageJob(job);
    console.log(`⏰ Dashboard auto messages restored: ${jobs.length}`);
  }


  function isCustomerSession(req) {
    return req.session?.loginRole === "customer" || req.session?.loginRole === "customer-oauth";
  }

  function isOwnerDashboardSession(req) {
    return Boolean(
      req.session?.ownerLoggedIn === true ||
      (req.session?.loggedIn && req.session?.loginRole !== "customer" && req.session?.loginRole !== "customer-oauth")
    );
  }

  function routeToInternalDashboardPath(routeName) {
    const clean = String(routeName || "dashboard").replace(/^\/+/, "").trim();

    if (!clean || clean === "dashboard") return "/dashboard";
    if (clean === "settings") return "/settings";
    if (clean === "command-center" || clean === "owner-command-center") return "/owner-command-center";
    if (clean === "premium-required") return "/premium-required";
    if (clean === "support") return "/support";
    if (clean === "premium-control") return "/premium-control";
    return `/${clean}`;
  }

  function isOwnerOnlyInternalPath(pathname) {
    return (
      pathname === "/owner-command-center" ||
      pathname.startsWith("/owner-command-center/") ||
      pathname === "/premium-control" ||
      pathname.startsWith("/premium-control/")
    );
  }

  function isPremiumTogglePath(pathname) {
    return pathname === "/settings/premium" || /^\/select-server\/\d+\/premium$/.test(pathname);
  }

  function withOriginalQuery(internalPath, originalUrl) {
    const queryIndex = String(originalUrl || "").indexOf("?");
    if (queryIndex === -1) return internalPath;
    return `${internalPath}${String(originalUrl).slice(queryIndex)}`;
  }

  
  // HOTFIX 18.3.2 OWNER SCOPED POST ALIASES
  // These routes keep owner form submissions inside owner mode and prevent accidental customer/login redirects.
  app.post("/owner/:guildId/premium-control/support", requireOwnerAuth, async (req, res, next) => {
    try {
      const guildId = String(req.params.guildId || "");
      const guild = client.guilds.cache.get(guildId);

      if (!guild) return dashboardJsonOrRedirect(req, res, "/owner/servers", { ok: false, message: "Server not found or bot is not installed there" });

      req.session.loginRole = "dashboard";
      req.session.loggedIn = true;
      req.session.ownerLoggedIn = true;
      req.session.selectedGuildId = guildId;
      req.session.scopedRouteBase = `/owner/${guildId}`;

      let supportUsers = [];
      try {
        supportUsers = String(req.body.supportUsers || "")
          .split("\\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 10)
          .map((line, index) => {
            const parts = line.split("|").map((part) => part.trim());
            return {
              label: parts[0] || `Support ${index + 1}`,
              username: parts[1] || parts[0] || "",
              discordId: parts[2] || "",
            };
          });
      } catch {
        supportUsers = [];
      }

      await DashboardSupportConfig.findOneAndUpdate(
        { guildId },
        {
          $set: {
            guildName: guild.name,
            supportTitle: String(req.body.supportTitle || "Need help unlocking Premium?").slice(0, 120),
            supportDescription: String(req.body.supportDescription || "Contact support to unlock this module for your server. You can also DM a support member.").slice(0, 700),
            supportInviteUrl: String(req.body.supportInviteUrl || "").slice(0, 300),
            supportButtonText: String(req.body.supportButtonText || "Click here to contact support").slice(0, 80),
            supportFooterNote: String(req.body.supportFooterNote || "Tell support which server and module you want to unlock.").slice(0, 250),
            supportUsers,
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      return res.redirect(`/owner/${guildId}/premium-control?success=${encodeURIComponent("Support settings saved")}`);
    } catch (err) {
      console.error("[Owner Scoped Support Save Error]", err);
      return res.redirect(`/owner/${req.params.guildId}/premium-control?error=${encodeURIComponent(err.message || "Failed to save support settings")}`);
    }
  });

  app.post("/owner/:guildId/premium-control/server", requireOwnerAuth, async (req, res) => {
    try {
      const guildId = String(req.params.guildId || "");
      const guild = client.guilds.cache.get(guildId);

      if (!guild) return dashboardJsonOrRedirect(req, res, "/owner/servers", { ok: false, message: "Server not found or bot is not installed there" });

      req.session.loginRole = "dashboard";
      req.session.loggedIn = true;
      req.session.ownerLoggedIn = true;
      req.session.selectedGuildId = guildId;
      req.session.scopedRouteBase = `/owner/${guildId}`;

      const enabled = String(req.body.premiumEnabled || "") === "on";

      await GuildPlan.findOneAndUpdate(
        { guildId },
        {
          $set: {
            guildName: guild.name,
            plan: enabled ? "premium" : "free",
            premiumEnabled: enabled,
            premiumUpdatedAt: new Date(),
            premiumUpdatedBy: "dashboard-owner",
          },
          $setOnInsert: {
            premiumSince: enabled ? new Date() : null,
          },
        },
        { upsert: true, new: true }
      );

      return res.redirect(`/owner/${guildId}/premium-control?success=${encodeURIComponent(`Full server Premium ${enabled ? "enabled" : "disabled"}`)}`);
    } catch (err) {
      console.error("[Owner Scoped Premium Server Save Error]", err);
      return res.redirect(`/owner/${req.params.guildId}/premium-control?error=${encodeURIComponent(err.message || "Failed to save server premium")}`);
    }
  });

  app.post("/owner/:guildId/premium-control/module", requireOwnerAuth, async (req, res) => {
    try {
      const guildId = String(req.params.guildId || "");
      const guild = client.guilds.cache.get(guildId);

      if (!guild) return dashboardJsonOrRedirect(req, res, "/owner/servers", { ok: false, message: "Server not found or bot is not installed there" });

      req.session.loginRole = "dashboard";
      req.session.loggedIn = true;
      req.session.ownerLoggedIn = true;
      req.session.selectedGuildId = guildId;
      req.session.scopedRouteBase = `/owner/${guildId}`;

      const moduleKey = String(req.body.moduleKey || "").trim();
      const enabled = String(req.body.enabled || "") === "on";

      if (!PREMIUM_MODULE_KEYS.has(moduleKey)) {
        return res.redirect(`/owner/${guildId}/premium-control?error=${encodeURIComponent("Unknown premium module")}`);
      }

      await GuildModuleUnlock.findOneAndUpdate(
        { guildId, moduleKey },
        {
          $set: {
            guildName: guild.name,
            moduleKey,
            enabled,
            updatedBy: "dashboard-owner",
            updatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      return res.redirect(`/owner/${guildId}/premium-control?success=${encodeURIComponent(`${moduleKey} ${enabled ? "unlocked" : "locked"}`)}`);
    } catch (err) {
      console.error("[Owner Scoped Premium Module Save Error]", err);
      return res.redirect(`/owner/${req.params.guildId}/premium-control?error=${encodeURIComponent(err.message || "Failed to save module premium")}`);
    }
  });

  app.post("/owner/:guildId/settings/premium", requireOwnerAuth, async (req, res) => {
    try {
      const guildId = String(req.params.guildId || "");
      const guild = client.guilds.cache.get(guildId);

      if (!guild) return dashboardJsonOrRedirect(req, res, "/owner/servers", { ok: false, message: "Server not found or bot is not installed there" });

      req.session.loginRole = "dashboard";
      req.session.loggedIn = true;
      req.session.ownerLoggedIn = true;
      req.session.selectedGuildId = guildId;
      req.session.scopedRouteBase = `/owner/${guildId}`;

      const enabled = String(req.body.premiumEnabled || "") === "on";

      await GuildPlan.findOneAndUpdate(
        { guildId },
        {
          $set: {
            guildName: guild.name,
            plan: enabled ? "premium" : "free",
            premiumEnabled: enabled,
            premiumUpdatedAt: new Date(),
            premiumUpdatedBy: "dashboard-owner",
          },
          $setOnInsert: {
            premiumSince: enabled ? new Date() : null,
          },
        },
        { upsert: true, new: true }
      );

      return res.redirect(`/owner/${guildId}/settings?success=${encodeURIComponent(`Premium ${enabled ? "enabled" : "disabled"} for ${guild.name}`)}`);
    } catch (err) {
      console.error("[Owner Scoped Settings Premium Save Error]", err);
      return res.redirect(`/owner/${req.params.guildId}/settings?error=${encodeURIComponent(err.message || "Failed to save premium setting")}`);
    }
  });


async function customerGuildAccessMiddleware(req, res, next) {
    // Customer dashboard pages ONLY use:
    // /customer/:userId/server/:guildId/dashboard
    // /customer/:userId/server/:guildId/settings
    // /customer/:userId/server/:guildId/premium-required
    //
    // This must NOT catch:
    // /customer/:userId/servers
    // /customer/:userId/server/:guildId/manage
    const match = req.path.match(/^\/customer\/(\d+)\/server\/(\d+)\/?([^?]*)/);
    if (!match) return next();

    const urlUserId = String(match[1] || "");
    const guildId = String(match[2] || "");
    const routeName = match[3] || "dashboard";

    // Let the real POST manage route handle the Manage button.
    if (req.method === "POST" && routeName === "manage") {
      return next();
    }

    const internalPath = routeToInternalDashboardPath(routeName);

    if (!req.session?.discordUser?.id || !Array.isArray(req.session?.discordGuilds)) {
      return dashboardJsonOrRedirect(req, res, "/customer", { ok: false, message: "Please login with Discord first" });
    }

    const sessionUserId = String(req.session.discordUser.id || "");
    if (urlUserId !== sessionUserId) {
      return res.redirect(`${customerServersPath(req)}?error=That customer page does not belong to your Discord account`);
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      req.session.selectedGuildId = null;
      if (req.session.lastCustomerGuildId === guildId) req.session.lastCustomerGuildId = null;
      return res.redirect(`${customerServersPath(req)}?error=Legendary Bot is not installed in that server`);
    }

    if (!customerCanManageGuild(req, guildId)) {
      req.session.selectedGuildId = null;
      return res.redirect(`${customerServersPath(req)}?error=You need Administrator or Manage Server permission for that server`);
    }

    // Customers do not get a Settings panel.
    if (routeName === "settings" || internalPath === "/settings") {
      return res.redirect(`${customerServerPath(req, guildId, "dashboard")}?error=Customer settings are not available`);
    }

    if (isOwnerOnlyInternalPath(internalPath) || isPremiumTogglePath(internalPath)) {
      return res.redirect(`${customerServerPath(req, guildId, "dashboard")}?error=This is an owner-only dashboard tool`);
    }

    req.session.loggedIn = true;
    req.session.loginRole = "customer";
    req.session.selectedGuildId = guildId;
    req.session.lastCustomerGuildId = guildId;
    req.session.scopedRouteBase = customerServerPath(req, guildId, "").replace(/\/$/, "");
    req._scopedDashboardRewrite = true;

    req.url = withOriginalQuery(internalPath, req.originalUrl || req.url);
    return next();
  }

  async function ownerGuildAccessMiddleware(req, res, next) {
    const match = req.path.match(/^\/owner\/(\d+)\/?([^?]*)/);
    if (!match) return next();

    if (!isOwnerDashboardSession(req)) {
      return res.redirect("/login");
    }

    const guildId = match[1];
    const routeName = match[2] || "dashboard";
    const internalPath = routeToInternalDashboardPath(routeName);
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return dashboardJsonOrRedirect(req, res, "/owner/servers", { ok: false, message: "Server not found or bot is not installed there" });
    }

    req.session.loginRole = "dashboard";
    req.session.selectedGuildId = guildId;
    req.session.scopedRouteBase = `/owner/${guildId}`;

    // Same protection for owner scoped routes.
    req._scopedDashboardRewrite = true;

    req.url = withOriginalQuery(internalPath, req.originalUrl || req.url);
    return next();
  }

  app.use(customerGuildAccessMiddleware);
  app.use(ownerGuildAccessMiddleware);

  app.use((req, res, next) => {
    // If this request already came from /customer/:guildId/... and was
    // internally rewritten to /dashboard, /settings, etc., let it pass.
    // Without this, Chrome gets ERR_TOO_MANY_REDIRECTS.
    if (req._scopedDashboardRewrite) return next();

    if (req.session?.loginRole !== "customer") return next();

    const guildId = req.session.selectedGuildId;

    if (isPremiumTogglePath(req.path)) {
      return res.redirect(guildId ? `${customerServerPath(req, guildId, "dashboard")}?error=Customers cannot change Premium status` : customerServersPath(req));
    }

    if (isOwnerOnlyInternalPath(req.path)) {
      return res.redirect(guildId ? `${customerServerPath(req, guildId, "dashboard")}?error=Owner Command Center is owner-only` : customerServersPath(req));
    }

    const genericDashboardPaths = new Set([
      "/dashboard",
      "/premium-required",
      "/message-builder",
      "/announcements",
      "/confession-style",
      "/yap-rumors",
      "/starboards",
      "/embed-templates",
      "/moderation",
      "/automations",
      "/custom-commands",
      "/ticketing",
      "/sports",
      "/predictions",
      "/search-anything",
      "/confessions",
      "/auto-messages",
      "/welcome-goodbye",
      "/reaction-roles",
      "/levels",
      "/polls",
      "/dashboard/giveaways",
    ]);

    if (guildId && genericDashboardPaths.has(req.path)) {
      return res.redirect(`${customerServerPath(req, guildId, req.path.replace(/^\//, "") || "dashboard")}${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`);
    }

    return next();
  });

  app.get("/owner/servers", requireAuth, async (req, res) => {
    if (!isOwnerDashboardSession(req)) return res.redirect("/login");

    const data = await buildViewData(req, "select-server", {
      servers: await getServerList(),
      selectorTitle: "Owner Server Selector",
      selectorSubtitle: "Choose any server where Legendary Bot is installed. Owner mode can manage Premium and owner-only tools.",
      error: req.query.error || null,
      success: req.query.success || null,
    });

    return res.render("select-server", data);
  });

  app.get("/", (req, res) => {
    if (req.session?.discordUser?.id && (req.session.loginRole === "customer" || req.session.loginRole === "customer-oauth")) {
      if (req.session.selectedGuildId) return res.redirect(customerServerPath(req, req.session.selectedGuildId, "dashboard"));
      return res.redirect(customerServersPath(req));
    }

    if (!req.session.loggedIn) return res.redirect("/login");
    if (!req.session.selectedGuildId) return res.redirect("/owner/servers");
    return res.redirect(`/owner/${req.session.selectedGuildId}/dashboard`);
  });

  app.get("/login", async (req, res) => {
    const data = await buildViewData(req, "login", { error: req.query.error || null });
    res.render("login", data);
  });

  app.post("/login", async (req, res) => {
    const password = String(req.body.password || "");

    if (password === DASHBOARD_PASSWORD) {
      req.session.loggedIn = true;
      req.session.ownerLoggedIn = true;
      req.session.loginRole = "dashboard";
      req.session.selectedGuildId = null;
      await saveDashboardLoginLog(req, "success", "dashboard", "password-login");
      return res.redirect("/owner/servers");
    }

    await saveDashboardLoginLog(req, "failed", "dashboard", "password-login", "Wrong password");
    const data = await buildViewData(req, "login", { error: "Wrong dashboard password." });
    return res.status(401).render("login", data);
  });

  app.get("/select-server", requireAuth, async (req, res) => {
    if (req.session.loginRole === "customer") return res.redirect(customerServersPath(req));
    if (isOwnerDashboardSession(req)) return res.redirect("/owner/servers");

    const data = await buildViewData(req, "select-server", {
      servers: await getServerList(),
      error: req.query.error || null,
      success: req.query.success || null,
    });

    res.render("select-server", data);
  });

  app.post("/select-server", requireAuth, async (req, res) => {
    if (req.session.loginRole === "customer") return res.redirect(customerServersPath(req));

    const guildId = String(req.body.guildId || req.body.serverId || req.query.guildId || "").trim();
    const guild = guildId ? client.guilds.cache.get(guildId) : null;

    if (!guild) {
      console.warn("[Owner Server Selector] Invalid server selected", {
        body: req.body,
        query: req.query,
        sessionRole: req.session.loginRole,
      });
      return res.redirect("/owner/servers?error=Invalid%20server%20selected");
    }

    req.session.selectedGuildId = guild.id;
    req.session.loginRole = "dashboard";
    req.session.loggedIn = true;
    req.session.ownerLoggedIn = true;

    return res.redirect(`/owner/${guild.id}/dashboard`);
  });

  app.post("/select-server/:guildId/premium", requireAuth, async (req, res) => {
    if (!isOwnerDashboardSession(req)) {
      return dashboardJsonOrRedirect(req, res, "/customer/servers", { ok: false, message: "Only the bot owner can change Premium status" });
    }

    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect("/owner/servers?error=Server%20not%20found");

    const enabled = String(req.body.premiumEnabled || "") === "on";

    await GuildPlan.findOneAndUpdate(
      { guildId: guild.id },
      {
        $set: {
          guildName: guild.name,
          plan: enabled ? "premium" : "free",
          premiumEnabled: enabled,
          premiumUpdatedAt: new Date(),
          premiumUpdatedBy: "dashboard-owner",
        },
        $setOnInsert: {
          premiumSince: enabled ? new Date() : null,
        },
      },
      { upsert: true, new: true }
    );

    return res.redirect(`/select-server?success=${encodeURIComponent(`${guild.name} is now ${enabled ? "Premium" : "Free"}`)}`);
  });

  app.post("/settings/premium", requireAuth, requireSelectedGuild, async (req, res) => {
    if (!isOwnerDashboardSession(req)) {
      const customerGuildId = req.session.selectedGuildId;
      return res.redirect(customerGuildId ? `${customerServerPath(req, customerGuildId, "dashboard")}?error=Only the bot owner can change Premium status` : `${customerServersPath(req)}?error=Only the bot owner can change Premium status`);
    }

    const guild = getSelectedGuild(req);
    if (!guild) return dashboardJsonOrRedirect(req, res, "/select-server", { ok: false, message: "Please select a server first" });

    const enabled = String(req.body.premiumEnabled || "") === "on";

    await GuildPlan.findOneAndUpdate(
      { guildId: guild.id },
      {
        $set: {
          guildName: guild.name,
          plan: enabled ? "premium" : "free",
          premiumEnabled: enabled,
          premiumUpdatedAt: new Date(),
          premiumUpdatedBy: "dashboard-owner",
        },
        $setOnInsert: {
          premiumSince: enabled ? new Date() : null,
        },
      },
      { upsert: true, new: true }
    );

    return res.redirect(`/owner/${guild.id}/settings?success=${encodeURIComponent(`Premium ${enabled ? "enabled" : "disabled"} for ${guild.name}`)}`);
  });


  app.get("/premium-control", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    const guild = getSelectedGuild(req);
    if (!guild) return dashboardJsonOrRedirect(req, res, "/owner/servers", { ok: false, message: "Please select a server first" });

    const plan = await getGuildPlan(guild);
    const unlockedModuleKeys = await getUnlockedModuleKeys(guild.id);
    const supportConfig = await getSupportConfig(guild);

    const premiumModules = navSections
      .flatMap((section) => section.items)
      .filter((item) => PREMIUM_MODULE_KEYS.has(item.key))
      .map((item) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
        unlocked: unlockedModuleKeys.has(item.key),
      }));

    const data = await buildViewData(req, "premium-control", {
      plan,
      premiumModules,
      supportConfig,
      success: req.query.success || null,
      error: req.query.error || null,
    });

    return res.render("premium-control", data);
  });

  app.post("/premium-control/server", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    const guild = getSelectedGuild(req);
    if (!guild) return dashboardJsonOrRedirect(req, res, "/owner/servers", { ok: false, message: "Please select a server first" });

    const enabled = String(req.body.premiumEnabled || "") === "on";

    await GuildPlan.findOneAndUpdate(
      { guildId: guild.id },
      {
        $set: {
          guildName: guild.name,
          plan: enabled ? "premium" : "free",
          premiumEnabled: enabled,
          premiumUpdatedAt: new Date(),
          premiumUpdatedBy: "dashboard-owner",
        },
        $setOnInsert: {
          premiumSince: enabled ? new Date() : null,
        },
      },
      { upsert: true, new: true }
    );

    return res.redirect(`/owner/${guild.id}/premium-control?success=${encodeURIComponent(`Full server Premium ${enabled ? "enabled" : "disabled"}`)}`);
  });

  app.post("/premium-control/module", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    const guild = getSelectedGuild(req);
    if (!guild) return dashboardJsonOrRedirect(req, res, "/owner/servers", { ok: false, message: "Please select a server first" });

    const moduleKey = String(req.body.moduleKey || "").trim();
    const enabled = String(req.body.enabled || "") === "on";

    if (!PREMIUM_MODULE_KEYS.has(moduleKey)) {
      return res.redirect(`/owner/${guild.id}/premium-control?error=${encodeURIComponent("Unknown premium module")}`);
    }

    await GuildModuleUnlock.findOneAndUpdate(
      { guildId: guild.id, moduleKey },
      {
        $set: {
          guildName: guild.name,
          moduleKey,
          enabled,
          updatedBy: "dashboard-owner",
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return res.redirect(`/owner/${guild.id}/premium-control?success=${encodeURIComponent(`${moduleKey} ${enabled ? "unlocked" : "locked"}`)}`);
  });

  app.post("/premium-control/support", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    const guild = getSelectedGuild(req);
    if (!guild) return dashboardJsonOrRedirect(req, res, "/owner/servers", { ok: false, message: "Please select a server first" });

    let supportUsers = [];
    try {
      supportUsers = String(req.body.supportUsers || "")
        .split("\\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((line, index) => {
          const parts = line.split("|").map((part) => part.trim());
          return {
            label: parts[0] || `Support ${index + 1}`,
            username: parts[1] || parts[0] || "",
            discordId: parts[2] || "",
          };
        });
    } catch {
      supportUsers = [];
    }

    await DashboardSupportConfig.findOneAndUpdate(
      { guildId: guild.id },
      {
        $set: {
          guildName: guild.name,
          supportTitle: String(req.body.supportTitle || "Need help unlocking Premium?").slice(0, 120),
          supportDescription: String(req.body.supportDescription || "Contact support to unlock this module for your server. You can also DM a support member.").slice(0, 700),
          supportInviteUrl: String(req.body.supportInviteUrl || "").slice(0, 300),
          supportButtonText: String(req.body.supportButtonText || "Click here to contact support").slice(0, 80),
          supportFooterNote: String(req.body.supportFooterNote || "Tell support which server and module you want to unlock.").slice(0, 250),
          supportUsers,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return res.redirect(`/owner/${guild.id}/premium-control?success=${encodeURIComponent("Support settings saved")}`);
  });

  app.get("/support", requireAuth, requireSelectedGuild, async (req, res) => {
    const guild = getSelectedGuild(req);
    const supportConfig = await getSupportConfig(guild);

    const data = await buildViewData(req, "support", {
      supportConfig,
      moduleName: req.query.module || "Premium",
      moduleKey: req.query.moduleKey || "",
      success: req.query.success || null,
      error: req.query.error || null,
    });

    return res.render("support", data);
  });

  app.get("/premium-required", requireAuth, requireSelectedGuild, async (req, res) => {
    const guild = getSelectedGuild(req);
    const supportConfig = await getSupportConfig(guild);

    const data = await buildViewData(req, "premium-required", {
      moduleName: req.query.module || "This module",
      moduleKey: req.query.moduleKey || String(req.query.module || "").trim(),
      supportConfig,
      supportLink:
        req.session?.loginRole === "customer"
          ? `${req.session?.scopedRouteBase || ""}/support?module=${encodeURIComponent(req.query.module || "Premium")}&moduleKey=${encodeURIComponent(req.query.moduleKey || "")}`
          : "",
      success: req.query.success || null,
      error: req.query.error || null,
    });

    return res.render("premium-required", data);
  });

  app.use(async (req, res, next) => {
    if (!req.session?.loggedIn) return next();
    if (!isPremiumRoute(req)) return next();

    const guildId = req.session.selectedGuildId;
    if (!guildId) return res.redirect("/select-server");

    const pathParts = req.path.split("/").filter(Boolean);
    const moduleKey = pathParts[0] === "dashboard" ? pathParts[1] : pathParts[0];
    const accessible = await isGuildModuleAccessible(guildId, moduleKey);
    if (accessible) return next();

    const base =
      req.session.loginRole === "customer"
        ? customerServerPath(req, guildId, "premium-required")
        : `/owner/${guildId}/premium-required`;

    return res.redirect(`${base}?module=${encodeURIComponent(moduleKey)}&moduleKey=${encodeURIComponent(moduleKey)}`);
  });

  app.get("/switch-server", requireAuth, (req, res) => {
    req.session.selectedGuildId = null;
    if (req.session.loginRole === "customer") return res.redirect(customerServersPath(req));
    return res.redirect("/owner/servers");
  });




  // Phase 17D hotfix:
  // This exact route must run before any broader customer redirects.
  // It always renders the customer server selector and NEVER redirects to itself.
  app.get("/customer/:userId/servers", requireDiscordAuth, requireCustomerUrlOwner, async (req, res) => {
    try {
    // Safe selector mode:
    // This route is the selector. It should never try to auto-open any server.
    req.session.lastCustomerGuildId = null;
    if (req.session.loginRole === "customer") {
      req.session.selectedGuildId = null;
    }

      req.session.lastCustomerGuildId = req.session.lastCustomerGuildId || null;

      const serverCards = await buildCustomerServerCards(req);

      const data = await buildViewData(req, "customer-servers", {
        discordUser: req.session.discordUser,
        customerBaseUrl: customerBasePath(req),
        servers: serverCards,
        inviteUrl: getBotInviteUrl(),
        error: req.query.error || null,
        success: req.query.success || null,
      });

      return res.render("customer-servers", data);
    } catch (err) {
      console.error("[Customer Servers Exact Route Error]", err);
      return redirectWithDashboardError(res, "/customer", "Failed to load your Discord servers", err);
    }
  });


  app.get("/app", async (req, res) => {
    try {
      if (!req.session?.discordUser?.id || !Array.isArray(req.session?.discordGuilds)) {
        rememberAfterDiscordLogin(req, "/app");
        return res.redirect("/auth/discord");
      }

      req.session.lastCustomerGuildId = null;

      if (req.session.loginRole === "customer") {
        req.session.selectedGuildId = null;
      }

      return res.redirect(customerServersPath(req));
    } catch (err) {
      console.error("[Quick App Route Error]", err);
      return redirectWithDashboardError(res, "/customer", "Failed to open customer server selector", err);
    }
  });

  app.get("/portal", (req, res) => {
    return res.redirect("/app");
  });

  app.get("/customer/dashboard", (req, res) => {
    return res.redirect("/app");
  });

  app.get("/customer", async (req, res) => {
    try {
      if (!req.query.error && req.session?.discordUser?.id && Array.isArray(req.session?.discordGuilds)) {
        return res.redirect("/app");
      }

      const data = await buildViewData(req, "customer-home", {
        error: req.query.error || null,
        success: req.query.success || null,
        discordUser: req.session.discordUser || null,
        loginUrl: "/auth/discord",
        inviteUrl: getBotInviteUrl(),
      });

      return res.render("customer-home", data);
    } catch (err) {
      console.error("[Customer Home Error]", err);
      return redirectWithDashboardError(res, "/login", "Failed to open customer website", err);
    }
  });

  app.get("/customer/login", (req, res) => {
    return res.redirect("/auth/discord");
  });

  app.get("/auth/discord", (req, res) => {
    if (req.query.next) {
      const nextPath = String(req.query.next || "");
      if (nextPath.startsWith("/") && !nextPath.startsWith("//")) {
        rememberAfterDiscordLogin(req, nextPath.slice(0, 300));
      }
    }

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      return dashboardJsonOrRedirect(req, res, "/customer", { ok: false, message: "Discord OAuth is not configured yet" });
    }

    const state = crypto.randomBytes(18).toString("hex");
    req.session.discordOAuthState = state;

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: DISCORD_REDIRECT_URI,
      response_type: "code",
      scope: "identify guilds",
      state,
      prompt: "none",
    });

    return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  });

  app.get("/auth/discord/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code) {
        return dashboardJsonOrRedirect(req, res, "/customer", { ok: false, message: "Discord login cancelled or failed" });
      }

      if (!state || state !== req.session.discordOAuthState) {
        return dashboardJsonOrRedirect(req, res, "/customer", { ok: false, message: "Discord login state mismatch. Please try again" });
      }

      req.session.discordOAuthState = null;

      const tokenData = await exchangeDiscordCode(String(code));
      const accessToken = tokenData.access_token;

      const [user, guilds] = await Promise.all([
        fetchDiscordJson("https://discord.com/api/users/@me", accessToken),
        fetchDiscordJson("https://discord.com/api/users/@me/guilds", accessToken),
      ]);

      req.session.discordUser = {
        id: user.id,
        username: user.username,
        globalName: user.global_name || "",
        avatar: user.avatar || "",
        avatarUrl: getDiscordAvatarUrl(user),
      };

      req.session.discordGuilds = guilds || [];
      req.session.discordAccessToken = accessToken;
      req.session.loginRole = "customer-oauth";

      await saveCustomerAccount(user, guilds || []);

      const afterLogin = req.session.afterDiscordLogin || null;
      req.session.afterDiscordLogin = null;

      if (afterLogin && String(afterLogin).startsWith("/") && !String(afterLogin).startsWith("//")) {
        return res.redirect(afterLogin);
      }

      return res.redirect(customerServersPath(req));
    } catch (err) {
      console.error("[Discord OAuth Callback Error]", err);
      return redirectWithDashboardError(res, "/customer", "Discord login failed", err);
    }
  });

  app.get("/customer/servers", requireDiscordAuth, (req, res) => {
    return res.redirect(customerServersPath(req));
  });

  app.get("/customer/:userId", requireDiscordAuth, requireCustomerUrlOwner, (req, res) => {
    return res.redirect(customerServersPath(req));
  });



  app.post("/customer/servers/:guildId/manage", requireDiscordAuth, (req, res) => {
    return res.redirect(`${customerBasePath(req)}/servers?error=Please use the updated customer server page`);
  });



  app.post("/customer/:userId/server/:guildId/manage", requireDiscordAuth, requireCustomerUrlOwner, async (req, res) => {
    try {
      const guildId = String(req.params.guildId || "");
      const botGuild = client.guilds.cache.get(guildId);

      if (!botGuild) {
        if (req.session.lastCustomerGuildId === guildId) req.session.lastCustomerGuildId = null;
        if (req.session.selectedGuildId === guildId) req.session.selectedGuildId = null;
        return res.redirect(`${customerServersPath(req)}?error=Legendary Bot is not installed in that server`);
      }

      if (!customerCanManageGuild(req, guildId)) {
        return res.redirect(`${customerServersPath(req)}?error=You need Administrator or Manage Server permission for that server`);
      }

      req.session.loggedIn = true;
      req.session.loginRole = "customer";
      req.session.selectedGuildId = guildId;
      req.session.lastCustomerGuildId = guildId;

      return res.redirect(customerServerPath(req, guildId, "dashboard"));
    } catch (err) {
      console.error("[Customer Manage Server Error]", err);
      return redirectWithDashboardError(res, customerServersPath(req), "Failed to open customer dashboard", err);
    }
  });

  app.get("/customer/logout", (req, res) => {
    req.session.discordUser = null;
    req.session.discordGuilds = null;
    req.session.discordAccessToken = null;
    req.session.lastCustomerGuildId = null;
    req.session.afterDiscordLogin = null;

    if (req.session.loginRole === "customer" || req.session.loginRole === "customer-oauth") {
      req.session.loggedIn = false;
      req.session.selectedGuildId = null;
      req.session.loginRole = null;
    }

    return res.redirect("/customer");
  });

  app.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
  });

  app.get("/admin", requireOwnerAuth, async (req, res) => {
    try {
      const [recentCases, recentWarnings, recentNotes, loginLogs] = await Promise.all([
        ModerationCase.find({}).sort({ createdAt: -1 }).limit(8).catch(() => []),
        ModerationWarning.find({}).sort({ createdAt: -1 }).limit(8).catch(() => []),
        ModerationNote.find({}).sort({ createdAt: -1 }).limit(8).catch(() => []),
        DashboardLoginLog.find({}).sort({ createdAt: -1 }).limit(8).catch(() => []),
      ]);

      const data = await buildViewData(req, "admin", {
        servers: await getAdminServers(),
        recentCases,
        recentWarnings,
        recentNotes,
        loginLogs,
        pageTitle: "AI Session Chat",
        pageSubtitle: "Wake-up AI chat, role limits, idle sleep, stop command, and saved MongoDB settings.",
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("admin", data);
    } catch (err) {
      console.error("[Owner Admin Home Error]", err);
      return redirectWithDashboardError(res, "/login", "Failed to open owner admin panel", err);
    }
  });

  app.get("/admin/servers", requireOwnerAuth, async (req, res) => {
    try {
      const data = await buildViewData(req, "admin-servers", {
        servers: await getAdminServers(),
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("admin-servers", data);
    } catch (err) {
      console.error("[Owner Admin Servers Error]", err);
      return redirectWithDashboardError(res, "/admin", "Failed to open server list", err);
    }
  });

  app.post("/admin/servers/:guildId/manage", requireOwnerAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);

    if (!guild) {
      return dashboardJsonOrRedirect(req, res, "/admin/servers", { ok: false, message: "Server not found or bot is not in that server" });
    }

    req.session.selectedGuildId = guild.id;
    return res.redirect("/dashboard");
  });

  app.get("/admin/command-center", requireOwnerAuth, async (req, res) => {
    try {
      const selectedAdminGuildId = req.query.guildId || req.session.adminCommandGuildId || client.guilds.cache.first()?.id || "";
      req.session.adminCommandGuildId = selectedAdminGuildId;

      const data = await buildViewData(req, "admin-command-center", {
        servers: await getAdminServers(),
        selectedAdminGuildId,
        channels: await getAdminTextChannels(selectedAdminGuildId),
        commands: client.commands ? [...client.commands.keys()].sort() : [],
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("admin-command-center", data);
    } catch (err) {
      console.error("[Owner Command Center Error]", err);
      return redirectWithDashboardError(res, "/admin", "Failed to open command center", err);
    }
  });

  app.post("/admin/command-center", requireOwnerAuth, async (req, res) => {
    try {
      const { guildId, action, channelId, userId, reason, message, seconds } = req.body;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: false, message: "Invalid server selected" });

      req.session.adminCommandGuildId = guild.id;

      const cleanReason = String(reason || "Owner dashboard action").slice(0, 500);
      const botMember = guild.members.me;

      if (action === "send-message") {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || channel.guildId !== guild.id) return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: false, message: "Invalid channel selected" });
        if (!String(message || "").trim()) return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: false, message: "Message cannot be empty" });
        await channel.send(String(message).slice(0, 1900));
        return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: true, message: "Message sent successfully" });
      }

      if (["lock-channel", "unlock-channel", "slowmode"].includes(action)) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || channel.guildId !== guild.id) return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: false, message: "Invalid channel selected" });

        if (action === "lock-channel") {
          await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
          return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: true, message: "Channel locked successfully" });
        }

        if (action === "unlock-channel") {
          await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
          return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: true, message: "Channel unlocked successfully" });
        }

        if (action === "slowmode") {
          const rateLimitPerUser = Math.max(0, Math.min(21600, Number(seconds || 0)));
          await channel.setRateLimitPerUser(rateLimitPerUser, cleanReason);
          return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: true, message: "Slowmode updated successfully" });
        }
      }

      if (["warn-user", "timeout-user", "untimeout-user", "kick-user", "ban-user", "unban-user"].includes(action)) {
        if (!userId) return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: false, message: "User ID is required for this action" });

        if (action === "unban-user") {
          await guild.members.unban(userId, cleanReason);
          await createOwnerModerationCase({ guildId: guild.id, targetId: userId, action: "unban", reason: cleanReason });
          return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: true, message: "User unbanned successfully" });
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: false, message: "Member not found in selected server" });

        if (member.id === guild.ownerId) return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: false, message: "Cannot moderate the server owner" });
        if (member.id === client.user.id) return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: false, message: "Cannot moderate the bot itself" });

        if (action === "warn-user") {
          await ModerationWarning.create({ guildId: guild.id, userId: member.id, moderatorId: client.user.id, reason: cleanReason });
          await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "warn", reason: cleanReason });
          return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: true, message: "Warning saved successfully" });
        }

        if (action === "timeout-user") {
          await member.timeout(Math.max(60, Number(seconds || 600)) * 1000, cleanReason);
          await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "timeout", reason: cleanReason, durationMs: Math.max(60, Number(seconds || 600)) * 1000 });
          return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: true, message: "Member timed out successfully" });
        }

        if (action === "untimeout-user") {
          await member.timeout(null, cleanReason);
          await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "untimeout", reason: cleanReason });
          return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: true, message: "Member timeout removed successfully" });
        }

        if (action === "kick-user") {
          await member.kick(cleanReason);
          await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "kick", reason: cleanReason });
          return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: true, message: "Member kicked successfully" });
        }

        if (action === "ban-user") {
          await member.ban({ reason: cleanReason });
          await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "ban", reason: cleanReason });
          return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: true, message: "Member banned successfully" });
        }
      }

      return dashboardJsonOrRedirect(req, res, "/admin/command-center", { ok: false, message: "Unknown owner dashboard action" });
    } catch (err) {
      console.error("[Owner Command Center Action Error]", err);
      return redirectWithDashboardError(res, "/admin/command-center", "Failed to run owner action", err);
    }
  });

  app.get("/admin/system", requireOwnerAuth, async (req, res) => {
    try {
      const checks = [
        { label: "Bot Status", value: client.isReady() ? "Online" : "Offline" },
        { label: "Bot Tag", value: client.user?.tag || "Loading" },
        { label: "Version", value: DASHBOARD_VERSION },
        { label: "Servers", value: String(client.guilds.cache.size) },
        { label: "Commands", value: String(client.commands?.size || 0) },
        { label: "Uptime", value: formatUptime(client.uptime || 0) },
        { label: "Node.js", value: process.version },
        { label: "Memory", value: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB` },
        { label: "MongoDB URI", value: process.env.MONGODB_URI ? "Configured" : "Missing" },
        { label: "Owner Username", value: process.env.OWNER_USERNAME ? "Configured" : "Using fallback" },
      ];

      const data = await buildViewData(req, "admin-system", { checks, success: req.query.success || null, error: req.query.error || null });
      return res.render("admin-system", data);
    } catch (err) {
      console.error("[Owner Admin System Error]", err);
      return redirectWithDashboardError(res, "/admin", "Failed to open system page", err);
    }
  });

  app.get("/admin/logs", requireOwnerAuth, async (req, res) => {
    try {
      const [loginLogs, cases, warnings, notes] = await Promise.all([
        DashboardLoginLog.find({}).sort({ createdAt: -1 }).limit(50).catch(() => []),
        ModerationCase.find({}).sort({ createdAt: -1 }).limit(50).catch(() => []),
        ModerationWarning.find({}).sort({ createdAt: -1 }).limit(50).catch(() => []),
        ModerationNote.find({}).sort({ createdAt: -1 }).limit(50).catch(() => []),
      ]);

      const data = await buildViewData(req, "admin-logs", { loginLogs, cases, warnings, notes, success: req.query.success || null, error: req.query.error || null });
      return res.render("admin-logs", data);
    } catch (err) {
      console.error("[Owner Admin Logs Error]", err);
      return redirectWithDashboardError(res, "/admin", "Failed to open owner logs", err);
    }
  });

  app.get("/owner-command-center", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      if (!isOwnerDashboardSession(req)) return res.redirect("/login");

      req.session.loginRole = "dashboard";
      req.session.loggedIn = true;
      req.session.ownerLoggedIn = true;

      const guildId = getGuildId(req);
      if (guildId && guildId !== "unknown") {
        req.session.scopedRouteBase = `/owner/${guildId}`;
      }

      const data = await buildViewData(req, "owner-command-center", {
        selectedModule: "command-center",
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("command-center", data);
    } catch (err) {
      console.error("[Owner Command Center Render Error]", err?.stack || err?.message || err);
      return sendDashboardError(req, res, "/dashboard", "Failed to load Legendary Command Center", err, 500);
    }
  });

  app.get("/owner-command-center/api/members", requireAuth, requireSelectedGuild, async (req, res) => {
    if (!isOwnerDashboardSession(req)) return res.status(403).json({ ok: false, error: "Owner-only API" });
    try {
      const guild = getSelectedGuild(req);
      const members = await searchGuildMembers(guild, req.query.q || "");
      return res.json({ ok: true, members });
    } catch (err) {
      return res.status(500).json({ ok: false, error: getDashboardErrorMessage(err, "Failed to search members") });
    }
  });

  app.get("/owner-command-center/api/roles", requireAuth, requireSelectedGuild, async (req, res) => {
    if (!isOwnerDashboardSession(req)) return res.status(403).json({ ok: false, error: "Owner-only API" });
    try {
      const guild = getSelectedGuild(req);
      const q = String(req.query.q || "").trim().toLowerCase();
      const roles = (await getAdminRoles(guild.id)).filter((role) => !q || role.name.toLowerCase().includes(q)).slice(0, 25);
      return res.json({ ok: true, roles });
    } catch (err) {
      return res.status(500).json({ ok: false, error: getDashboardErrorMessage(err, "Failed to search roles") });
    }
  });

  app.post("/owner-command-center", requireAuth, requireSelectedGuild, async (req, res) => {
    if (!isOwnerDashboardSession(req)) {
      const gid = req.session.selectedGuildId;
      return res.redirect(gid ? `/customer/${gid}/dashboard?error=Owner Command Center is owner-only` : "/customer/servers");
    }

    const guild = getSelectedGuild(req);
    const action = String(req.body.action || "");
    const cleanReason = String(req.body.reason || "Dashboard owner action").slice(0, 500);

    async function finish(status, message, details = {}) {
      await createDashboardActionLog({ guild, action, status: status === "success" ? "success" : "failed", reason: cleanReason, details, error: status === "error" ? message : "" });
      return res.redirect(`/owner-command-center?${status === "success" ? "success" : "error"}=${encodeURIComponent(message)}`);
    }

    try {
      if (!guild) return dashboardJsonOrRedirect(req, res, "/select-server", { ok: false, message: "Please select a server first" });

      const {
        channelId,
        roleId,
        userId,
        userIds,
        reason,
        message,
        text,
        amount,
        seconds,
        hexColor,
        confirmText,
      } = req.body;

      const allActions = flattenCommandCatalog(commandCenterCatalog());
      const actionInfo = allActions.find((item) => item.id === action);
      if (!actionInfo) return finish("error", "Unknown dashboard action");

      if (actionInfo.confirmText && String(confirmText || "").trim().toUpperCase() !== actionInfo.confirmText) {
        return finish("error", `Type ${actionInfo.confirmText} in the confirmation box before running this dangerous action.`);
      }

      const getTextChannel = async () => {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || channel.guildId !== guild.id) throw new Error("Invalid channel selected");
        return channel;
      };

      const getRole = async () => {
        await guild.roles.fetch().catch(() => null);
        const role = guild.roles.cache.get(roleId);
        if (!role) throw new Error("Invalid role selected");
        return role;
      };

      const getMember = async (id = userId) => {
        const cleanId = String(id || "").replace(/[<@!>]/g, "");
        if (!cleanId) throw new Error("Please select a member first");
        const member = await guild.members.fetch(cleanId).catch(() => null);
        const check = canModerateTarget(guild, member);
        if (!check.ok) throw new Error(check.reason);
        return member;
      };

      const sendResult = async (content, preferredChannelId = channelId) => {
        const clean = String(content || "").slice(0, 1900);
        if (preferredChannelId) {
          const channel = await client.channels.fetch(preferredChannelId).catch(() => null);
          if (channel && channel.guildId === guild.id && channel.send) {
            await channel.send(clean);
            return `Result sent in #${channel.name}`;
          }
        }
        return clean;
      };

      if (action === "send-message") {
        const channel = await getTextChannel();
        if (!String(message || "").trim()) throw new Error("Message cannot be empty");
        await channel.send(String(message).slice(0, 1900));
        return finish("success", `Message sent in #${channel.name}`, { channelId: channel.id, channelName: channel.name });
      }

      if (["lock-channel", "unlock-channel", "slowmode"].includes(action)) {
        const channel = await getTextChannel();
        if (action === "lock-channel") {
          await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, { reason: cleanReason });
          await createOwnerModerationCase({ guildId: guild.id, action: "lock", reason: cleanReason });
          return finish("success", `#${channel.name} locked successfully`, { channelId: channel.id });
        }
        if (action === "unlock-channel") {
          await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }, { reason: cleanReason });
          await createOwnerModerationCase({ guildId: guild.id, action: "unlock", reason: cleanReason });
          return finish("success", `#${channel.name} unlocked successfully`, { channelId: channel.id });
        }
        const rateLimitPerUser = Math.max(0, Math.min(21600, Number(seconds || 0)));
        await channel.setRateLimitPerUser(rateLimitPerUser, cleanReason);
        await createOwnerModerationCase({ guildId: guild.id, action: "slowmode", reason: cleanReason, durationMs: rateLimitPerUser * 1000 });
        return finish("success", `Slowmode set to ${rateLimitPerUser}s in #${channel.name}`, { channelId: channel.id, seconds: rateLimitPerUser });
      }

      if (["ban-user", "kick-user", "timeout-user", "untimeout-user", "warn-user", "warnings-user", "clearwarnings-user"].includes(action)) {
        const member = await getMember();
        if (action === "ban-user") {
          await member.ban({ reason: cleanReason });
          await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "ban", reason: cleanReason });
          return finish("success", `${humanUser(member)} banned successfully`, { targetId: member.id });
        }
        if (action === "kick-user") {
          await member.kick(cleanReason);
          await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "kick", reason: cleanReason });
          return finish("success", `${humanUser(member)} kicked successfully`, { targetId: member.id });
        }
        if (action === "timeout-user") {
          const durationMs = Math.max(60, Number(seconds || 600)) * 1000;
          await member.timeout(durationMs, cleanReason);
          await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "timeout", reason: cleanReason, durationMs });
          return finish("success", `${humanUser(member)} timed out successfully`, { targetId: member.id, durationMs });
        }
        if (action === "untimeout-user") {
          await member.timeout(null, cleanReason);
          await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "untimeout", reason: cleanReason });
          return finish("success", `${humanUser(member)} timeout removed`, { targetId: member.id });
        }
        if (action === "warn-user") {
          await ModerationWarning.create({ guildId: guild.id, userId: member.id, moderatorId: client.user.id, reason: cleanReason });
          await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "warn", reason: cleanReason });
          return finish("success", `${humanUser(member)} warned successfully`, { targetId: member.id });
        }
        if (action === "warnings-user") {
          const warnings = await ModerationWarning.find({ guildId: guild.id, userId: member.id }).sort({ createdAt: -1 }).limit(10).catch(() => []);
          const result = warnings.length ? warnings.map((w, i) => `${i + 1}. ${w.reason || "No reason"}`).join(" | ") : "No warnings found.";
          return finish("success", `Warnings for ${humanUser(member)}: ${result}`, { targetId: member.id });
        }
        const deleted = await ModerationWarning.deleteMany({ guildId: guild.id, userId: member.id });
        await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "clearwarnings", reason: cleanReason });
        return finish("success", `Cleared ${deleted.deletedCount || 0} warnings for ${humanUser(member)}`, { targetId: member.id });
      }

      if (action === "unban-user" || action === "hackban") {
        const ids = parseUserIds(userId || userIds);
        if (!ids.length) throw new Error("Enter a user ID first");
        if (action === "unban-user") {
          await guild.members.unban(ids[0], cleanReason);
          await createOwnerModerationCase({ guildId: guild.id, targetId: ids[0], action: "unban", reason: cleanReason });
          return finish("success", `User ID ${ids[0]} unbanned successfully`, { targetId: ids[0] });
        }
        await guild.members.ban(ids[0], { reason: cleanReason });
        await createOwnerModerationCase({ guildId: guild.id, targetId: ids[0], action: "hackban", reason: cleanReason });
        return finish("success", `User ID ${ids[0]} hackbanned successfully`, { targetId: ids[0] });
      }

      if (["purge", "purgebot", "purgeuser"].includes(action)) {
        const channel = await getTextChannel();
        const limit = Math.max(1, Math.min(100, Number(amount || 10)));
        const fetched = await channel.messages.fetch({ limit }).catch(() => null);
        if (!fetched) throw new Error("Could not fetch messages. Make sure bot can read message history.");
        let messages = [...fetched.values()];
        if (action === "purgebot") messages = messages.filter((msg) => msg.author.bot);
        if (action === "purgeuser") {
          const targetId = String(userId || "").replace(/[<@!>]/g, "");
          if (!targetId) throw new Error("Select a user for purgeuser");
          messages = messages.filter((msg) => msg.author.id === targetId);
        }
        const deleted = await channel.bulkDelete(messages.slice(0, limit), true).catch((err) => { throw new Error(err.message || "Bulk delete failed"); });
        await createOwnerModerationCase({ guildId: guild.id, action, reason: cleanReason });
        return finish("success", `Deleted ${deleted.size || 0} messages in #${channel.name}`, { channelId: channel.id, deleted: deleted.size || 0 });
      }

      if (action === "nuke-channel") {
        const channel = await getTextChannel();
        const clone = await channel.clone({ reason: cleanReason });
        await clone.setPosition(channel.rawPosition).catch(() => null);
        await channel.delete(cleanReason);
        await createOwnerModerationCase({ guildId: guild.id, action: "nuke", reason: cleanReason });
        return finish("success", `Channel nuked and recreated as #${clone.name}`, { channelId: clone.id });
      }

      if (["nickname", "cleannick", "dehoist", "strip-roles"].includes(action)) {
        const member = await getMember();
        if (action === "nickname") {
          const newName = String(text || "").trim().slice(0, 32);
          if (!newName) throw new Error("Enter a nickname in the text field");
          await member.setNickname(newName, cleanReason);
          return finish("success", `Nickname changed for ${humanUser(member)}`, { targetId: member.id });
        }
        if (action === "cleannick") {
          await member.setNickname(null, cleanReason);
          return finish("success", `Nickname cleared for ${humanUser(member)}`, { targetId: member.id });
        }
        if (action === "dehoist") {
          const name = member.displayName.replace(/^[^a-zA-Z0-9]+/, "");
          await member.setNickname(name || member.user.username, cleanReason);
          return finish("success", `Dehoisted ${humanUser(member)}`, { targetId: member.id });
        }
        const botHighest = guild.members.me?.roles.highest.position || 0;
        const removable = member.roles.cache.filter((role) => role.id !== guild.id && role.position < botHighest);
        await member.roles.remove([...removable.keys()], cleanReason);
        await createOwnerModerationCase({ guildId: guild.id, targetId: member.id, action: "strip", reason: cleanReason });
        return finish("success", `Removed ${removable.size} manageable roles from ${humanUser(member)}`, { targetId: member.id, removed: removable.size });
      }

      if (["massban", "masskick", "massmute", "massunmute", "massdeafen", "massundeafen"].includes(action)) {
        const ids = parseUserIds(userIds || userId);
        if (!ids.length) throw new Error("Enter one or more user IDs");
        let count = 0;
        for (const id of ids) {
          try {
            if (action === "massban") {
              await guild.members.ban(id, { reason: cleanReason });
              count++;
              continue;
            }
            const member = await guild.members.fetch(id).catch(() => null);
            const check = canModerateTarget(guild, member);
            if (!check.ok) continue;
            if (action === "masskick") await member.kick(cleanReason);
            if (action === "massmute") await member.timeout(Math.max(60, Number(seconds || 600)) * 1000, cleanReason);
            if (action === "massunmute") await member.timeout(null, cleanReason);
            if (action === "massdeafen" && member.voice?.channel) await member.voice.setDeaf(true, cleanReason);
            if (action === "massundeafen" && member.voice?.channel) await member.voice.setDeaf(false, cleanReason);
            count++;
          } catch {}
        }
        await createOwnerModerationCase({ guildId: guild.id, action, reason: cleanReason });
        return finish("success", `${action} completed for ${count}/${ids.length} users`, { count, total: ids.length });
      }

      if (["vcban", "unvcban"].includes(action)) {
        const member = await getMember();
        if (action === "vcban") {
          await ModerationVcBan.findOneAndUpdate({ guildId: guild.id, userId: member.id }, { guildId: guild.id, userId: member.id, reason: cleanReason }, { upsert: true, new: true });
          if (member.voice?.channel) await member.voice.disconnect(cleanReason).catch(() => null);
          return finish("success", `${humanUser(member)} VC banned successfully`, { targetId: member.id });
        }
        await ModerationVcBan.deleteOne({ guildId: guild.id, userId: member.id });
        return finish("success", `${humanUser(member)} VC ban removed`, { targetId: member.id });
      }

      if (["note", "notes", "clearnotes", "history"].includes(action)) {
        const member = await getMember();
        if (action === "note") {
          const noteText = String(text || "").trim().slice(0, 1000);
          if (!noteText) throw new Error("Enter note text");
          await ModerationNote.create({ guildId: guild.id, userId: member.id, moderatorId: client.user.id, note: noteText });
          return finish("success", `Note saved for ${humanUser(member)}`, { targetId: member.id });
        }
        if (action === "notes") {
          const notes = await ModerationNote.find({ guildId: guild.id, userId: member.id }).sort({ createdAt: -1 }).limit(10).catch(() => []);
          const result = notes.length ? notes.map((n, i) => `${i + 1}. ${n.note || n.text || "No text"}`).join(" | ") : "No notes found.";
          return finish("success", `Notes for ${humanUser(member)}: ${result}`, { targetId: member.id });
        }
        if (action === "clearnotes") {
          const deleted = await ModerationNote.deleteMany({ guildId: guild.id, userId: member.id });
          return finish("success", `Cleared ${deleted.deletedCount || 0} notes for ${humanUser(member)}`, { targetId: member.id });
        }
        const cases = await ModerationCase.find({ guildId: guild.id, targetId: member.id }).sort({ createdAt: -1 }).limit(10).catch(() => []);
        const result = cases.length ? cases.map((c) => `#${c.caseId} ${c.action}: ${c.reason}`).join(" | ") : "No history found.";
        return finish("success", `History for ${humanUser(member)}: ${result}`, { targetId: member.id });
      }

      if (["setcolor", "mentionable", "roledump"].includes(action)) {
        const role = await getRole();
        if (action === "setcolor") {
          const color = String(hexColor || "").trim();
          if (!/^#[0-9A-Fa-f]{6}$/.test(color)) throw new Error("Enter a valid hex color like #ff0000");
          await role.setColor(color, cleanReason);
          return finish("success", `Role ${role.name} color changed to ${color}`, { roleId: role.id });
        }
        if (action === "mentionable") {
          await role.setMentionable(!role.mentionable, cleanReason);
          return finish("success", `Role ${role.name} mentionable is now ${!role.mentionable ? "ON" : "OFF"}`, { roleId: role.id });
        }
        const members = role.members.map((m) => m.displayName).slice(0, 40);
        return finish("success", members.length ? `${role.name} members: ${members.join(", ")}` : `No cached members found for ${role.name}`, { roleId: role.id });
      }

      if (["invites", "clearinvites", "createinvite"].includes(action)) {
        if (action === "invites") {
          const invites = await guild.invites.fetch().catch(() => null);
          const result = invites?.size ? invites.map((inv) => `${inv.code}: ${inv.uses || 0} uses`).slice(0, 15).join(" | ") : "No invites found or bot lacks permission.";
          return finish("success", result);
        }
        if (action === "clearinvites") {
          const invites = await guild.invites.fetch().catch(() => null);
          let count = 0;
          if (invites) {
            for (const inv of invites.values()) {
              await inv.delete(cleanReason).then(() => count++).catch(() => null);
            }
          }
          return finish("success", `Deleted ${count} invites`, { count });
        }
        const channel = await getTextChannel();
        const invite = await channel.createInvite({ maxAge: 0, maxUses: 0, reason: cleanReason });
        return finish("success", `Invite created: ${invite.url}`, { channelId: channel.id });
      }

      if (["setlog", "setwelcome", "setverify"].includes(action)) {
        const channel = await getTextChannel();
        const update = { guildId: guild.id };
        if (action === "setlog") Object.assign(update, { logChannelId: channel.id, logChannelName: channel.name });
        if (action === "setwelcome") Object.assign(update, { welcomeChannelId: channel.id, welcomeChannelName: channel.name });
        if (action === "setverify") {
          const role = await getRole();
          Object.assign(update, { verifyChannelId: channel.id, verifyChannelName: channel.name, verifyRoleId: role.id, verifyRoleName: role.name });
        }
        await ModerationConfig.findOneAndUpdate({ guildId: guild.id }, update, { upsert: true, new: true });
        return finish("success", `${action} saved successfully`, update);
      }

      if (/^(automod|antilink|antispam|antiraid)-(on|off)$/.test(action)) {
        const [, key, state] = action.match(/^(automod|antilink|antispam|antiraid)-(on|off)$/);
        const map = { automod: "automodEnabled", antilink: "antiLinkEnabled", antispam: "antiSpamEnabled", antiraid: "antiRaidEnabled" };
        await ModerationConfig.findOneAndUpdate({ guildId: guild.id }, { guildId: guild.id, [map[key]]: state === "on" }, { upsert: true, new: true });
        return finish("success", `${key} turned ${state.toUpperCase()}`);
      }

      if (["userinfo", "avatar"].includes(action)) {
        const member = await getMember();
        if (action === "avatar") return finish("success", `${humanUser(member)} avatar: ${member.user.displayAvatarURL({ size: 1024 })}`, { targetId: member.id });
        return finish("success", `${humanUser(member)} | ID: ${member.id} | Joined: ${member.joinedAt?.toLocaleString() || "Unknown"} | Roles: ${member.roles.cache.size - 1}`, { targetId: member.id });
      }

      if (action === "serverinfo") {
        return finish("success", `${guild.name} | ID: ${guild.id} | Members: ${guild.memberCount || 0} | Channels: ${guild.channels.cache.size} | Roles: ${guild.roles.cache.size}`);
      }

      if (action === "servericon") {
        return finish("success", guild.iconURL({ size: 1024 }) || "This server has no icon.");
      }

      if (["choose", "reverse", "roll", "coinflip", "eightball", "poll", "joke", "quote", "rps", "trivia", "roast", "define", "weather"].includes(action)) {
        let content = "";
        if (action === "choose") {
          const options = String(text || "").split(",").map((x) => x.trim()).filter(Boolean);
          if (options.length < 2) throw new Error("Enter at least 2 options separated by commas");
          content = `I choose: **${options[Math.floor(Math.random() * options.length)]}**`;
        }
        if (action === "reverse") content = String(text || "").split("").reverse().join("");
        if (action === "roll") content = `🎲 Rolled **${Math.floor(Math.random() * 100) + 1}**`;
        if (action === "coinflip") content = Math.random() > 0.5 ? "🪙 Heads" : "🪙 Tails";
        if (action === "eightball") {
          const answers = ["Yes", "No", "Maybe", "Definitely", "Ask again later", "Very likely", "Not looking good"];
          content = `🎱 ${answers[Math.floor(Math.random() * answers.length)]}`;
        }

        if (action === "joke") content = "😂 Why did the bot cross the server? To get to the other channel.";
        if (action === "quote") content = "👑 Stay focused, stay respectful, and keep building legendary things.";
        if (action === "rps") {
          const choice = String(text || "").trim().toLowerCase();
          const valid = ["rock", "paper", "scissors"];
          if (!valid.includes(choice)) throw new Error("Type rock, paper, or scissors in the text field");
          const botChoice = valid[Math.floor(Math.random() * valid.length)];
          content = `✊✋✌️ You chose **${choice}**, I chose **${botChoice}**.`;
        }
        if (action === "trivia") content = "🧠 Trivia: What does API stand for? Answer: Application Programming Interface.";
        if (action === "roast") {
          const member = await getMember();
          content = `🔥 ${member.displayName}, your Wi-Fi has more stability than your excuses.`;
        }
        if (action === "define") {
          const word = String(text || "").trim();
          if (!word) throw new Error("Enter a word or phrase to define");
          content = `📖 **${word}** — a term selected from the owner dashboard. Add a dictionary API later for live definitions.`;
        }
        if (action === "weather") {
          const place = String(text || "").trim();
          if (!place) throw new Error("Enter a city/location in the text field");
          content = `🌦️ Weather requested for **${place}**. Connect a weather API later for live dashboard weather results.`;
        }

        if (action === "poll") {
          const parts = String(text || "").split("|").map((x) => x.trim()).filter(Boolean);
          if (parts.length < 3) throw new Error("Use: Question | Option 1 | Option 2");
          const channel = await getTextChannel();
          const pollText = [`📊 **${parts[0]}**`, "", ...parts.slice(1).map((option, i) => `${i + 1}. ${option}`)].join("\n");
          const sent = await channel.send(pollText);
          const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
          for (let i = 0; i < Math.min(parts.length - 1, emojis.length); i++) await sent.react(emojis[i]).catch(() => null);
          return finish("success", `Poll sent in #${channel.name}`, { channelId: channel.id });
        }
        const sentResult = await sendResult(content, channelId);
        return finish("success", sentResult, { content });
      }

      return finish("error", "This dashboard action is listed but not implemented yet.");
    } catch (err) {
      console.error("[Dashboard Owner Command Action Error]", err);
      await createDashboardActionLog({ guild, action, status: "failed", reason: cleanReason, error: err.message || String(err) });
      return redirectWithDashboardError(res, "/owner-command-center", "Failed to run dashboard action", err);
    }
  });

  app.get("/dashboard", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
    const selectedGuild = getSelectedGuild(req);
    const selectedGuildPlan = selectedGuild ? await getGuildPlan(selectedGuild) : null;
    const premiumEnabled = Boolean(selectedGuildPlan?.premiumEnabled || selectedGuildPlan?.plan === "premium");
    const unlockedModuleKeys = selectedGuild ? await getUnlockedModuleKeys(selectedGuild.id) : new Set();
    const dashboardRouteBase =
      req.session?.loginRole === "customer" && selectedGuild
        ? customerServerPath(req, selectedGuild.id, "").replace(/\/$/, "")
        : selectedGuild
          ? `/owner/${selectedGuild.id}`
          : "";

    const data = await buildViewData(req, "dashboard", {
pluginCards: buildPremiumPluginCards([

  {
    title: "Message Builder",
    icon: "📝",
    status: "Live",
    desc: "Send custom normal messages and rich embeds directly from your dashboard.",
    href: "/message-builder",
  },
  {
    title: "Settings",
    icon: "⚙️",
    status: "Live",
    desc: "View bot status, environment checks, version info, and dashboard settings.",
    href: "/settings",
  },
  {
    title: "Confessions",
    icon: "💌",
    status: "Live",
    desc: "Manage anonymous confessions, reply tracking, and confession search.",
    href: "/confessions",
  },
  {
    title: "Confession Style",
    icon: "🎨",
    status: "Live",
    desc: "Customize confession embed colors, labels, footer, buttons, and preview.",
    href: "/confession-style",
  },
  {
    title: "Auto Messages",
    icon: "⏰",
    status: "Live",
    desc: "Create repeating messages with normal text and embed support.",
    href: "/auto-messages",
  },
  {
    title: "Yap & Rumors",
    icon: "🗣️",
    status: "Live",
    desc: "Control yap loops, rumor loops, custom content, and fallback content.",
    href: "/yap-rumors",
  },
  {
    title: "Welcome & Goodbye",
    icon: "👋",
    status: "Live",
    desc: "Customize welcome and goodbye messages, embeds, colors, channels, and previews.",
    href: "/welcome-goodbye",
  },
  {
    title: "Reaction Roles",
    icon: "🎭",
    status: "Live",
    desc: "Create button role panels that members can click to get or remove roles.",
    href: "/reaction-roles",
  },
  {
    title: "Levels",
    icon: "🏆",
    status: "Live",
    desc: "Configure XP, level-up messages, cooldowns, reward roles, ignored channels, and multipliers.",
    href: "/levels",
  },
  {
    title: "Starboards",
    icon: "⭐",
    status: "Live",
    desc: "Configure starboard channels, star count requirements, and repost style.",
    href: "/starboards",
  },
  {
    title: "Announcements",
    icon: "📣",
    status: "Live",
    desc: "Send clean announcement messages and embeds from the dashboard.",
    href: "/announcements",
  },
  {
    title: "Embed Templates",
    icon: "📦",
    status: "Live",
    desc: "Save reusable embed designs for announcements, welcomes, giveaways, and more.",
    href: "/embed-templates",
  },
  {
    title: "Moderation",
    icon: "🛡️",
    status: "Live",
    desc: "Manage moderation tools, warnings, punishments, and staff controls.",
    href: "/moderation",
  },
  {
    title: "Automations",
    icon: "🔁",
    status: "Live",
    desc: "Create server automations, scheduled actions, and dashboard controlled workflows.",
    href: "/automations",
  },
  {
    title: "Custom Commands",
    icon: "⌨️",
    status: "Live",
    desc: "Create and manage custom bot commands directly from the dashboard.",
    href: "/custom-commands",
  },
  {
    title: "Ticketing",
    icon: "🎫",
    status: "Live",
    desc: "Configure support tickets, ticket panels, categories, and staff access.",
    href: "/ticketing",
  },
  {
    title: "AI Tickets",
    icon: "🤖",
    status: "Owner",
    desc: "Manage AI TicketTool flows, staff applications, scoring logic, auto approve role, report webhook, and review routing.",
    href: "/ai-tickets",
  },
  {
    title: "Giveaways V2",
    key: "giveaways",
    icon: "🎉",
    status: "Premium",
    desc: "Create, manage, end, reroll, and track giveaways from the dashboard.",
    href: "/dashboard/giveaways",
  },
  {
    title: "Sports",
    icon: "⚽",
    status: "Live",
    desc: "Save football, cricket, and goal alert channels from dashboard.",
    href: "/sports",
  },
  {
    title: "Predictions",
    icon: "🎯",
    status: "Live",
    desc: "Configure prediction games and community guessing systems.",
    href: "/predictions",
  },
  {
    title: "Polls",
    icon: "📊",
    status: "Live",
    desc: "Create polls, voting buttons, and community choice messages.",
    href: "/polls",
  },
  {
    title: "Search Anything",
    icon: "🔎",
    status: "Live",
    desc: "Search dashboard tools, saved systems, templates, and server features.",
    href: "/search-anything",
  },
], premiumEnabled, req.session?.loginRole === "customer" ? "customer" : "owner", dashboardRouteBase, unlockedModuleKeys),
    });

    res.render("dashboard", data);
    } catch (err) {
      console.error("[Dashboard Page Error]", err);
      return res.status(500).send("Dashboard failed to load. Check Railway logs for [Dashboard Page Error].");
    }
  });

   app.get("/message-builder", requireAuth, requireSelectedGuild, async (req, res) => {
    const guildId = getGuildId(req);

    const templates = await modelFindSafe(
      DashboardEmbedTemplate,
      {
        guildId,
        enabled: true,
      },
      null,
      { sort: { createdAt: -1 } }
    );

    const data = await buildViewData(req, "message-builder", {
      channelGroups: await getChannelGroups(req),
      templates,
      success: req.query.success || null,
      error: req.query.error || null,
    });

    res.render("message-builder", data);
  });

  app.post("/api/send-message", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const {
        channelId,
        content,
        embedTitle,
        embedDescription,
        embedColor,
        footerText,
        imageUrl,
        thumbnailUrl,
        saveAsTemplate,
        templateName,
        onlySaveTemplate,
      } = req.body;

      if (saveAsTemplate === "on" || onlySaveTemplate === "yes") {
        await saveEmbedTemplateFromRequest(req, {
          name: templateName || embedTitle || "Message Builder Template",
          category: "Message Builder",
          sourceModule: "message-builder",
          sourceLabel: "Built from Message Builder",
          templateType: "message-builder",
          content,
          embedTitle,
          embedDescription,
          embedColor,
          embedFooter: footerText,
          embedImage: imageUrl,
          embedThumbnail: thumbnailUrl,
        });
      }

      if (onlySaveTemplate === "yes") {
        return dashboardJsonOrRedirect(req, res, "/message-builder", { ok: true, message: "Template saved successfully" });
      }

      if (!channelId) return dashboardJsonOrRedirect(req, res, "/message-builder", { ok: false, message: "Please select a channel" });

      const channel = await client.channels.fetch(channelId).catch(() => null);

      if (
        !channel ||
        channel.guildId !== getGuildId(req) ||
        (channel.type !== ChannelType.GuildText &&
          channel.type !== ChannelType.GuildAnnouncement)
      ) {
        return dashboardJsonOrRedirect(req, res, "/message-builder", { ok: false, message: "Invalid channel selected" });
      }

      const trimmedContent = (content || "").trim();

      const hasEmbed =
        (embedTitle || "").trim() ||
        (embedDescription || "").trim() ||
        (footerText || "").trim() ||
        (imageUrl || "").trim() ||
        (thumbnailUrl || "").trim();

      const payload = {};

      if (trimmedContent) payload.content = trimmedContent;

      if (hasEmbed) {
        const embed = new EmbedBuilder().setColor((embedColor || "#8b5cf6").trim());

        if ((embedTitle || "").trim()) embed.setTitle(embedTitle.trim());
        if ((embedDescription || "").trim()) embed.setDescription(embedDescription.trim());
        if ((footerText || "").trim()) embed.setFooter({ text: footerText.trim() });
        if ((imageUrl || "").trim()) embed.setImage(imageUrl.trim());
        if ((thumbnailUrl || "").trim()) embed.setThumbnail(thumbnailUrl.trim());

        payload.embeds = [embed];
      }

      if (!payload.content && !payload.embeds) {
        return dashboardJsonOrRedirect(req, res, "/message-builder", { ok: false, message: "Nothing to send" });
      }

      await channel.send(payload);
      return dashboardJsonOrRedirect(req, res, "/message-builder", { ok: true, message: "Message sent successfully" });
    } catch (error) {
      console.error("Dashboard send-message error:", error);
      return redirectWithDashboardError(res, "/message-builder", "Failed to send message", error);
    }
  });

   app.get("/announcements", requireAuth, requireSelectedGuild, async (req, res) => {
    const guildId = getGuildId(req);

    const templates = await modelFindSafe(
      DashboardEmbedTemplate,
      {
        guildId,
        enabled: true,
      },
      null,
      { sort: { createdAt: -1 } }
    );

    const data = await buildViewData(req, "announcements", {
      channelGroups: await getChannelGroups(req),
      templates,
      success: req.query.success || null,
      error: req.query.error || null,
    });

    res.render("announcements", data);
  });
  
  app.post("/announcements/send", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const {
        channelId,
        mentionMode,
        content,
        embedTitle,
        embedDescription,
        embedColor,
        embedFooter,
        embedImage,
        embedThumbnail,
        saveAsTemplate,
        templateName,
        onlySaveTemplate,
      } = req.body;

      if (saveAsTemplate === "on" || onlySaveTemplate === "yes") {
        await saveEmbedTemplateFromRequest(req, {
          name: templateName || embedTitle || "Announcement Template",
          category: "Announcements",
          sourceModule: "announcements",
          sourceLabel: "Built from Announcements",
          templateType: "announcement",
          content,
          embedTitle,
          embedDescription,
          embedColor,
          embedFooter,
          embedImage,
          embedThumbnail,
        });
      }

      if (onlySaveTemplate === "yes") {
        return dashboardJsonOrRedirect(req, res, "/announcements", { ok: true, message: "Template saved successfully" });
      }

      if (!channelId) return dashboardJsonOrRedirect(req, res, "/announcements", { ok: false, message: "Please select a channel" });

      const channel = await client.channels.fetch(channelId).catch(() => null);

      if (
        !channel ||
        channel.guildId !== getGuildId(req) ||
        (channel.type !== ChannelType.GuildText &&
          channel.type !== ChannelType.GuildAnnouncement)
      ) {
        return dashboardJsonOrRedirect(req, res, "/announcements", { ok: false, message: "Invalid channel selected" });
      }

      let finalContent = (content || "").trim();

      if (mentionMode === "everyone") {
        finalContent = `@everyone${finalContent ? `\n${finalContent}` : ""}`;
      }

      if (mentionMode === "here") {
        finalContent = `@here${finalContent ? `\n${finalContent}` : ""}`;
      }

      const hasEmbed =
        (embedTitle || "").trim() ||
        (embedDescription || "").trim() ||
        (embedFooter || "").trim() ||
        (embedImage || "").trim() ||
        (embedThumbnail || "").trim();

      const payload = {};

      if (finalContent) payload.content = finalContent;

      if (hasEmbed) {
        const embed = new EmbedBuilder().setColor((embedColor || "#8b5cf6").trim());

        if ((embedTitle || "").trim()) embed.setTitle(embedTitle.trim());
        if ((embedDescription || "").trim()) embed.setDescription(embedDescription.trim());
        if ((embedFooter || "").trim()) embed.setFooter({ text: embedFooter.trim() });
        if ((embedImage || "").trim()) embed.setImage(embedImage.trim());
        if ((embedThumbnail || "").trim()) embed.setThumbnail(embedThumbnail.trim());

        payload.embeds = [embed];
      }

      if (!payload.content && !payload.embeds) {
        return dashboardJsonOrRedirect(req, res, "/announcements", { ok: false, message: "Nothing to send" });
      }

      await channel.send(payload);
      return dashboardJsonOrRedirect(req, res, "/announcements", { ok: true, message: "Announcement sent successfully" });
    } catch (err) {
      console.error("[Dashboard Announcement Send Error]", err);
      return redirectWithDashboardError(res, "/announcements", "Failed to send announcement", err);
    }
  });

  app.get("/embed-templates", requireAuth, requireSelectedGuild, async (req, res) => {
    const guildId = getGuildId(req);

    const templates = await modelFindSafe(
      DashboardEmbedTemplate,
      { guildId },
      null,
      { sort: { createdAt: -1 } }
    );

    const data = await buildViewData(req, "embed-templates", {
      templates,
      success: req.query.success || null,
      error: req.query.error || null,
    });

    res.render("embed-templates", data);
  });

  app.post("/embed-templates/create", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      const {
        name,
        category,
        content,
        embedTitle,
        embedDescription,
        embedColor,
        embedFooter,
        embedImage,
        embedThumbnail,
      } = req.body;

      if (!name || !name.trim()) {
        return dashboardJsonOrRedirect(req, res, "/embed-templates", { ok: false, message: "Template name is required" });
      }

      const hasAnything =
        (content || "").trim() ||
        (embedTitle || "").trim() ||
        (embedDescription || "").trim() ||
        (embedFooter || "").trim() ||
        (embedImage || "").trim() ||
        (embedThumbnail || "").trim();

      if (!hasAnything) {
        return dashboardJsonOrRedirect(req, res, "/embed-templates", { ok: false, message: "Template cannot be empty" });
      }

      await DashboardEmbedTemplate.create({
        guildId,
        name: name.trim(),
        category: category?.trim() || "General",
        sourceModule: "embed-templates",
        sourceLabel: "Built from Embed Templates",
        templateType: "embed-template",
        content: content?.trim() || "",
        embedTitle: embedTitle?.trim() || "",
        embedDescription: embedDescription?.trim() || "",
        embedColor: embedColor?.trim() || "#8b5cf6",
        embedFooter: embedFooter?.trim() || "",
        embedImage: embedImage?.trim() || "",
        embedThumbnail: embedThumbnail?.trim() || "",
        enabled: true,
      });

      return dashboardJsonOrRedirect(req, res, "/embed-templates", { ok: true, message: "Embed template saved" });
    } catch (err) {
      console.error("[Dashboard Embed Template Create Error]", err);
      return redirectWithDashboardError(res, "/embed-templates", "Failed to save template", err);
    }
  });

  app.post("/embed-templates/toggle/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const template = await DashboardEmbedTemplate.findById(req.params.id);

      if (!template || template.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/embed-templates", { ok: false, message: "Template not found" });
      }

      template.enabled = !template.enabled;
      await template.save();

      return dashboardJsonOrRedirect(req, res, "/embed-templates", { ok: true, message: "Template status updated" });
    } catch (err) {
      console.error("[Dashboard Embed Template Toggle Error]", err);
      return redirectWithDashboardError(res, "/embed-templates", "Failed to update template", err);
    }
  });

   app.get("/embed-templates/edit/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const template = await DashboardEmbedTemplate.findById(req.params.id);

      if (!template || template.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/embed-templates", { ok: false, message: "Template not found" });
      }

      const data = await buildViewData(req, "embed-template-edit", {
        template,
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("embed-template-edit", data);
    } catch (err) {
      console.error("[Dashboard Embed Template Edit Page Error]", err);
      return redirectWithDashboardError(res, "/embed-templates", "Failed to open template editor", err);
    }
  });

  app.post("/embed-templates/update/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const template = await DashboardEmbedTemplate.findById(req.params.id);

      if (!template || template.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/embed-templates", { ok: false, message: "Template not found" });
      }

      const {
        name,
        category,
        content,
        embedTitle,
        embedDescription,
        embedColor,
        embedFooter,
        embedImage,
        embedThumbnail,
      } = req.body;

      if (!name || !name.trim()) {
        return res.redirect(`/embed-templates/edit/${template._id}?error=Template name is required`);
      }

      const hasAnything =
        (content || "").trim() ||
        (embedTitle || "").trim() ||
        (embedDescription || "").trim() ||
        (embedFooter || "").trim() ||
        (embedImage || "").trim() ||
        (embedThumbnail || "").trim();

      if (!hasAnything) {
        return res.redirect(`/embed-templates/edit/${template._id}?error=Template cannot be empty`);
      }

      template.name = name.trim();
      template.category = category?.trim() || "General";
      template.content = content?.trim() || "";
      template.embedTitle = embedTitle?.trim() || "";
      template.embedDescription = embedDescription?.trim() || "";
      template.embedColor = embedColor?.trim() || "#8b5cf6";
      template.embedFooter = embedFooter?.trim() || "";
      template.embedImage = embedImage?.trim() || "";
      template.embedThumbnail = embedThumbnail?.trim() || "";

      await template.save();

      return res.redirect(`/embed-templates/edit/${template._id}?success=Template updated successfully`);
    } catch (err) {
      console.error("[Dashboard Embed Template Update Error]", err);
      return redirectWithDashboardError(res, "/embed-templates", "Failed to update template", err);
    }
  });

  app.post("/embed-templates/duplicate/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const template = await DashboardEmbedTemplate.findById(req.params.id);

      if (!template || template.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/embed-templates", { ok: false, message: "Template not found" });
      }

      await DashboardEmbedTemplate.create({
        guildId,
        name: `${template.name} Copy`,
        category: template.category || "General",
        sourceModule: template.sourceModule || "embed-templates",
        sourceLabel: `Duplicated from ${template.name}`,
        templateType: template.templateType || "embed",
        content: template.content || "",
        embedTitle: template.embedTitle || "",
        embedDescription: template.embedDescription || "",
        embedColor: template.embedColor || "#8b5cf6",
        embedFooter: template.embedFooter || "",
        embedImage: template.embedImage || "",
        embedThumbnail: template.embedThumbnail || "",
        enabled: true,
      });

      return dashboardJsonOrRedirect(req, res, "/embed-templates", { ok: true, message: "Template duplicated successfully" });
    } catch (err) {
      console.error("[Dashboard Embed Template Duplicate Error]", err);
      return redirectWithDashboardError(res, "/embed-templates", "Failed to duplicate template", err);
    }
  });
  app.get("/settings", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      if (req.session?.loginRole === "customer" || req.session?.loginRole === "customer-oauth") {
        const customerGuildId = req.session.selectedGuildId;
        return res.redirect(customerGuildId ? `${customerServerPath(req, customerGuildId, "dashboard")}?error=Customer settings are not available` : customerServersPath(req));
      }

      const checks = [
        { name: "Discord Token", ok: Boolean(process.env.DISCORD_TOKEN) },
        { name: "MongoDB URI", ok: Boolean(process.env.MONGODB_URI) },
        { name: "Server Mongo URI", ok: Boolean(process.env.MONGO_SERVER_URI) },
        { name: "Owner Mongo URI", ok: Boolean(process.env.MONGO_OWNER_URI) },
        { name: "Logs Mongo URI", ok: Boolean(process.env.MONGO_LOGS_URI) },
        { name: "Customer Mongo URI", ok: Boolean(process.env.MONGO_CUSTOMER_URI) },
        { name: "Customer Server Mongo URI", ok: Boolean(process.env.MONGO_CUSTOMER_SERVER_URI) },
        { name: "Gemini API Key", ok: Boolean(process.env.AI_INTEGRATIONS_GEMINI_API_KEY) },
        { name: "Cricket API Key", ok: Boolean(process.env.CRICKET_API_KEY) },
        { name: "Football API Key", ok: Boolean(process.env.FOOTBALL_API_KEY) },
        { name: "Dashboard Password", ok: Boolean(process.env.DASHBOARD_PASSWORD) },
        { name: "Session Secret", ok: Boolean(process.env.SESSION_SECRET) },
        { name: "Optional Custom Banner URL", ok: Boolean(process.env.DASHBOARD_BANNER_URL) },
      ];

      const data = await buildViewData(req, "settings", {
        checks,
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("settings", data);
    } catch (err) {
      console.error("[Owner Settings Page Error]", err);
      return redirectWithDashboardError(res, "/owner/servers", "Failed to load owner settings", err);
    }
  });

  app.get("/confessions", requireAuth, requireSelectedGuild, async (req, res) => {
    const guildId = getGuildId(req);
    const config = await LoopConfig.findOne({ guildId });
    const recent = await Confession.find({ guildId }).sort({ createdAt: -1 }).limit(12);

    const data = await buildViewData(req, "confessions", {
      channelGroups: await getChannelGroups(req),
      confessChannelId: config?.confessChannelId || "",
      recent,
      success: req.query.success || null,
      error: req.query.error || null,
      searchResult: null,
    });

    res.render("confessions", data);
  });

  app.post("/confessions/set-channel", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const { channelId } = req.body;

      if (!channelId) return dashboardJsonOrRedirect(req, res, "/confessions", { ok: false, message: "Please select a channel" });

      const channel = await client.channels.fetch(channelId).catch(() => null);

      if (!channel || channel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/confessions", { ok: false, message: "Invalid channel selected" });
      }

      await LoopConfig.findOneAndUpdate(
        { guildId },
        { $set: { confessChannelId: channelId } },
        { upsert: true, new: true }
      );

      return dashboardJsonOrRedirect(req, res, "/confessions", { ok: true, message: "Confession channel updated" });
    } catch (err) {
      console.error("[Dashboard Confession Set Channel Error]", err);
      return redirectWithDashboardError(res, "/confessions", "Failed to update channel", err);
    }
  });

    app.post("/confessions/search", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const { messageId } = req.body;

      const config = await LoopConfig.findOne({ guildId });
      const recent = await Confession.find({ guildId }).sort({ createdAt: -1 }).limit(12);

      const cleanMessageId = String(messageId || "").trim();

      const found = await Confession.findOne({
        guildId,
        messageId: cleanMessageId,
      });

      const data = await buildViewData(req, "confessions", {
        channelGroups: await getChannelGroups(req),
        confessChannelId: config?.confessChannelId || "",
        recent,
        success: null,
        error: found ? null : "No confession/reply found with that message ID",
        searchResult: found,
      });

      return res.render("confessions", data);
    } catch (err) {
      console.error("[Dashboard Confession Search Error]", err);
      return redirectWithDashboardError(res, "/confessions", "Failed to search confession", err);
    }
  });

    app.get("/confession-style", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      let style = await modelFindOneSafe(DashboardConfessionStyle, { guildId });

      if (!style) {
        style = await DashboardConfessionStyle.create({ guildId });
      }

      const data = await buildViewData(req, "confession-style", {
        style,
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("confession-style", data);
    } catch (err) {
      console.error("[Dashboard Confession Style Page Error]", err);
      return redirectWithDashboardError(res, "/confessions", "Failed to open confession style page", err);
    }
  });

  app.post("/confession-style/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      const {
        embedTitle,
        embedColor,
        embedFooter,
        embedThumbnail,
        embedImage,
        anonymousLabel,
        replyButtonLabel,
        reactionButtonLabel,
        showConfessionNumber,
        saveToTemplates,
      } = req.body;

      const style = await DashboardConfessionStyle.findOneAndUpdate(
        { guildId },
        {
          $set: {
            embedTitle: embedTitle?.trim() || "confession #{number}",
            embedColor: embedColor?.trim() || "#8b5cf6",
            embedFooter: embedFooter?.trim() || "💌 leave your own confession with /confess!",
            embedThumbnail: embedThumbnail?.trim() || "",
            embedImage: embedImage?.trim() || "",
            anonymousLabel: anonymousLabel?.trim() || "new confession!",
            replyButtonLabel: replyButtonLabel?.trim() || "Reply",
            reactionButtonLabel: reactionButtonLabel?.trim() || "React",
            showConfessionNumber: showConfessionNumber === "on",
            saveToTemplates: saveToTemplates === "on",
          },
        },
        { upsert: true, new: true }
      );

      if (style.saveToTemplates) {
        await saveEmbedTemplateFromRequest(req, {
          name: "Confession Embed Style",
          category: "Confessions",
          sourceModule: "confession-style",
          sourceLabel: "Built from Confession Style",
          templateType: "confession-style",
          content: "",
          embedTitle: style.embedTitle,
          embedDescription: `${style.anonymousLabel}\n\n{confession}`,
          embedColor: style.embedColor,
          embedFooter: style.embedFooter,
          embedImage: style.embedImage,
          embedThumbnail: style.embedThumbnail,
        });
      }

      return dashboardJsonOrRedirect(req, res, "/confession-style", { ok: true, message: "Confession style saved successfully" });
    } catch (err) {
      console.error("[Dashboard Confession Style Save Error]", err);
      return redirectWithDashboardError(res, "/confession-style", "Failed to save confession style", err);
    }
  });
  
  app.get("/auto-messages", requireAuth, requireSelectedGuild, async (req, res) => {
    const guildId = getGuildId(req);
    const jobs = await modelFindSafe(
      DashboardAutoMessage,
      { guildId },
      null,
      { sort: { createdAt: -1 } }
    );

    const data = await buildViewData(req, "auto-messages", {
      channelGroups: await getChannelGroups(req),
      jobs,
      success: req.query.success || null,
      error: req.query.error || null,
    });

    res.render("auto-messages", data);
  });

  app.post("/auto-messages/create", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      const {
        name,
        channelId,
        content,
        embedTitle,
        embedDescription,
        embedColor,
        embedFooter,
        embedImage,
        embedThumbnail,
        intervalHours,
        saveAsTemplate,
        templateName,
      } = req.body;

      const channel = await client.channels.fetch(channelId).catch(() => null);

      if (!channel || channel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/auto-messages", { ok: false, message: "Invalid channel" });
      }

      if (saveAsTemplate === "on") {
        await saveEmbedTemplateFromRequest(req, {
          name: templateName || embedTitle || name || "Auto Message Template",
          category: "Auto Messages",
          sourceModule: "auto-messages",
          sourceLabel: "Built from Auto Messages",
          templateType: "auto-message",
          content,
          embedTitle,
          embedDescription,
          embedColor,
          embedFooter,
          embedImage,
          embedThumbnail,
        });
      }

      const job = await DashboardAutoMessage.create({
        guildId,
        channelId,
        channelName: channel.name || "unknown-channel",
        name: name?.trim() || "Auto Message",
        content: content?.trim() || "",
        embedTitle: embedTitle?.trim() || "",
        embedDescription: embedDescription?.trim() || "",
        embedColor: embedColor?.trim() || "#8b5cf6",
        embedFooter: embedFooter?.trim() || "",
        embedImage: embedImage?.trim() || "",
        embedThumbnail: embedThumbnail?.trim() || "",
        intervalHours: Number(intervalHours || 12),
        active: true,
      });

      startAutoMessageJob(job);

      return dashboardJsonOrRedirect(req, res, "/auto-messages", { ok: true, message: "Auto message created" });
    } catch (err) {
      console.error("[Dashboard Auto Message Create Error]", err);
      return redirectWithDashboardError(res, "/auto-messages", "Failed to create auto message", err);
    }
  });

  app.post("/auto-messages/send-now/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const job = await DashboardAutoMessage.findById(req.params.id);

      if (!job || job.guildId !== getGuildId(req)) {
        return dashboardJsonOrRedirect(req, res, "/auto-messages", { ok: false, message: "Auto message not found" });
      }

      await sendAutoMessage(job);
      return dashboardJsonOrRedirect(req, res, "/auto-messages", { ok: true, message: "Auto message sent now" });
    } catch (err) {
      console.error("[Dashboard Auto Message Send Now Error]", err);
      return redirectWithDashboardError(res, "/auto-messages", "Failed to send auto message", err);
    }
  });

  app.post("/auto-messages/toggle/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const job = await DashboardAutoMessage.findById(req.params.id);

      if (!job || job.guildId !== getGuildId(req)) {
        return dashboardJsonOrRedirect(req, res, "/auto-messages", { ok: false, message: "Auto message not found" });
      }

      job.active = !job.active;
      await job.save();

      if (job.active) startAutoMessageJob(job);
      else stopAutoMessageJob(String(job._id));

      return dashboardJsonOrRedirect(req, res, "/auto-messages", { ok: true, message: "Auto message status updated" });
    } catch (err) {
      console.error("[Dashboard Auto Message Toggle Error]", err);
      return redirectWithDashboardError(res, "/auto-messages", "Failed to update auto message", err);
    }
  });

  app.post("/auto-messages/delete/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const job = await DashboardAutoMessage.findById(req.params.id);

      if (!job || job.guildId !== getGuildId(req)) {
        return dashboardJsonOrRedirect(req, res, "/auto-messages", { ok: false, message: "Auto message not found" });
      }

      stopAutoMessageJob(req.params.id);
      await DashboardAutoMessage.findByIdAndDelete(req.params.id);

      return dashboardJsonOrRedirect(req, res, "/auto-messages", { ok: true, message: "Auto message deleted" });
    } catch (err) {
      console.error("[Dashboard Auto Message Delete Error]", err);
      return redirectWithDashboardError(res, "/auto-messages", "Failed to delete auto message", err);
    }
  });

  app.get("/sports", requireAuth, requireSelectedGuild, async (req, res) => {
    const guildId = getGuildId(req);
    const config =
      (await modelFindOneSafe(DashboardSportsConfig, { guildId })) ||
      new DashboardSportsConfig({ guildId });

    const data = await buildViewData(req, "sports", {
      channelGroups: await getChannelGroups(req),
      sportsConfig: config,
      success: req.query.success || null,
      error: req.query.error || null,
    });

    res.render("sports", data);
  });

  app.post("/sports/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      const {
        footballChannelId,
        cricketChannelId,
        goalAlertChannelId,
        updateMinutes,
        footballEnabled,
        cricketEnabled,
        goalAlertsEnabled,
      } = req.body;

      const footballChannel = footballChannelId
        ? await client.channels.fetch(footballChannelId).catch(() => null)
        : null;

      const cricketChannel = cricketChannelId
        ? await client.channels.fetch(cricketChannelId).catch(() => null)
        : null;

      const goalAlertChannel = goalAlertChannelId
        ? await client.channels.fetch(goalAlertChannelId).catch(() => null)
        : null;

      if (footballChannel && footballChannel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/sports", { ok: false, message: "Invalid football channel" });
      }

      if (cricketChannel && cricketChannel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/sports", { ok: false, message: "Invalid cricket channel" });
      }

      if (goalAlertChannel && goalAlertChannel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/sports", { ok: false, message: "Invalid goal alert channel" });
      }

      await DashboardSportsConfig.findOneAndUpdate(
        { guildId },
        {
          $set: {
            footballChannelId: footballChannelId || "",
            footballChannelName: footballChannel?.name || "",
            cricketChannelId: cricketChannelId || "",
            cricketChannelName: cricketChannel?.name || "",
            goalAlertChannelId: goalAlertChannelId || "",
            goalAlertChannelName: goalAlertChannel?.name || "",
            updateMinutes: Number(updateMinutes || 5),
            footballEnabled: footballEnabled === "on",
            cricketEnabled: cricketEnabled === "on",
            goalAlertsEnabled: goalAlertsEnabled === "on",
          },
        },
        { upsert: true, new: true }
      );

      // Keep slash-command sports live system synced with dashboard MongoDB settings.
      // /footballlive and /cricketlive use sportsLoopManager, so we mirror channel/auto values there too.
      if (footballChannelId) {
        sportsLoopManager.setChannel(guildId, "football", footballChannelId);
        sportsLoopManager.setLocked(guildId, "football", true);
      }

      if (cricketChannelId) {
        sportsLoopManager.setChannel(guildId, "cricket", cricketChannelId);
        sportsLoopManager.setLocked(guildId, "cricket", true);
      }

      sportsLoopManager.setAuto(guildId, "football", footballEnabled === "on");
      sportsLoopManager.setAuto(guildId, "cricket", cricketEnabled === "on");
      sportsLoopManager.refreshGuildLoops(guildId);

      return dashboardJsonOrRedirect(req, res, "/sports", { ok: true, message: "Sports settings saved successfully" });
    } catch (err) {
      console.error("[Dashboard Sports Save Error]", err);
      return redirectWithDashboardError(res, "/sports", "Failed to save sports settings", err);
    }
  });

  app.post("/sports/test/:type", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const config = await modelFindOneSafe(DashboardSportsConfig, { guildId });

      if (!config) {
        return dashboardJsonOrRedirect(req, res, "/sports", { ok: false, message: "Save sports settings first" });
      }

      let channelId = "";
      let title = "";
      let description = "";

      if (req.params.type === "football") {
        channelId = config.footballChannelId;
        title = "⚽ Football Test Alert";
        description = "This is a test football alert from Legendary Bot Dashboard.";
      }

      if (req.params.type === "cricket") {
        channelId = config.cricketChannelId;
        title = "🏏 Cricket Test Alert";
        description = "This is a test cricket alert from Legendary Bot Dashboard.";
      }

      if (req.params.type === "goal") {
        channelId = config.goalAlertChannelId;
        title = "🚨 Goal Alert Test";
        description = "GOAL ALERT test is working from Legendary Bot Dashboard.";
      }

      if (!channelId) {
        return dashboardJsonOrRedirect(req, res, "/sports", { ok: false, message: "Please save that channel first" });
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);

      if (!channel || channel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/sports", { ok: false, message: "Saved channel was not found" });
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor("#8b5cf6")
        .setFooter({ text: "Legendary Bot Sports Dashboard" })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      return dashboardJsonOrRedirect(req, res, "/sports", { ok: true, message: "Test alert sent successfully" });
    } catch (err) {
      console.error("[Dashboard Sports Test Error]", err);
      return redirectWithDashboardError(res, "/sports", "Failed to send test alert", err);
    }
  });

  app.get("/yap-rumors", requireAuth, requireSelectedGuild, async (req, res) => {
    const guildId = getGuildId(req);

    const cfg = await LoopConfig.findOne({ guildId });
    const contents = await DashboardLoopContent.find({ guildId }).sort({ createdAt: -1 });

    const data = await buildViewData(req, "yap-rumors", {
      channelGroups: await getChannelGroups(req),
      loopConfig: cfg,
      contents,
      success: req.query.success || null,
      error: req.query.error || null,
    });

    res.render("yap-rumors", data);
  });

  app.post("/yap-rumors/save-loops", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      const {
        yapChannelId,
        yapIntervalMinutes,
        yapActive,
        rumorChannelId,
        rumorIntervalMinutes,
        rumorsActive,
      } = req.body;

      if (yapActive === "on") {
        if (!yapChannelId) {
          return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: false, message: "Please select a yap channel" });
        }

        const channel = await client.channels.fetch(yapChannelId).catch(() => null);

        if (!channel || channel.guildId !== guildId) {
          return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: false, message: "Invalid yap channel" });
        }

        await loopManager.setLoop(
          guildId,
          "yap",
          yapChannelId,
          Math.max(5, Number(yapIntervalMinutes || 30)) * 60 * 1000
        );
      } else {
        await loopManager.clearLoop(guildId, "yap");
      }

      if (rumorsActive === "on") {
        if (!rumorChannelId) {
          return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: false, message: "Please select a rumor channel" });
        }

        const channel = await client.channels.fetch(rumorChannelId).catch(() => null);

        if (!channel || channel.guildId !== guildId) {
          return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: false, message: "Invalid rumor channel" });
        }

        await loopManager.setLoop(
          guildId,
          "rumors",
          rumorChannelId,
          Math.max(10, Number(rumorIntervalMinutes || 60)) * 60 * 1000
        );
      } else {
        await loopManager.clearLoop(guildId, "rumors");
      }

      return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: true, message: "Yap and rumor loop settings saved" });
    } catch (err) {
      console.error("[Dashboard Yap/Rumors Save Error]", err);
      return redirectWithDashboardError(res, "/yap-rumors", "Failed to save loop settings", err);
    }
  });

  app.post("/yap-rumors/send-now/:type", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const type = req.params.type;

      if (!["yap", "rumors"].includes(type)) {
        return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: false, message: "Invalid loop type" });
      }

      await loopManager.runOnce(guildId, type);

      return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: true, message: "Sent successfully" });
    } catch (err) {
      console.error("[Dashboard Yap/Rumors Send Now Error]", err);
      return redirectWithDashboardError(res, "/yap-rumors", "Failed to send now", err);
    }
  });

  app.post("/yap-rumors/add-content", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      const { type, sourceType, text } = req.body;

      if (!["yap", "rumor"].includes(type)) {
        return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: false, message: "Invalid content type" });
      }

      if (!["custom", "fallback"].includes(sourceType)) {
        return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: false, message: "Invalid source type" });
      }

      if (!text || !text.trim()) {
        return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: false, message: "Text is required" });
      }

      await DashboardLoopContent.create({
        guildId,
        type,
        sourceType,
        text: text.trim(),
        enabled: true,
      });

      return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: true, message: "Content added successfully" });
    } catch (err) {
      console.error("[Dashboard Add Yap/Rumor Content Error]", err);
      return redirectWithDashboardError(res, "/yap-rumors", "Failed to add content", err);
    }
  });

  app.post("/yap-rumors/toggle-content/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const item = await DashboardLoopContent.findById(req.params.id);

      if (!item || item.guildId !== getGuildId(req)) {
        return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: false, message: "Content item not found" });
      }

      item.enabled = !item.enabled;
      await item.save();

      return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: true, message: "Content status updated" });
    } catch (err) {
      console.error("[Dashboard Toggle Yap/Rumor Content Error]", err);
      return redirectWithDashboardError(res, "/yap-rumors", "Failed to update content", err);
    }
  });

  app.post("/yap-rumors/delete-content/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const item = await DashboardLoopContent.findById(req.params.id);

      if (!item || item.guildId !== getGuildId(req)) {
        return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: false, message: "Content item not found" });
      }

      await DashboardLoopContent.findByIdAndDelete(req.params.id);

      return dashboardJsonOrRedirect(req, res, "/yap-rumors", { ok: true, message: "Content deleted" });
    } catch (err) {
      console.error("[Dashboard Delete Yap/Rumor Content Error]", err);
      return redirectWithDashboardError(res, "/yap-rumors", "Failed to delete content", err);
    }
  });

  async function renderPlaceholder(req, res, currentPage, title, text) {
    const data = await buildViewData(req, currentPage, {
      placeholderTitle: title,
      placeholderText: text,
    });

    res.render("placeholder", data);
  }

  app.get("/welcome-goodbye", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      let settings = await modelFindOneSafe(DashboardWelcomeGoodbye, { guildId });

      if (!settings) {
        settings = await DashboardWelcomeGoodbye.create({ guildId });
      }

      const data = await buildViewData(req, "welcome-goodbye", {
        channelGroups: await getChannelGroups(req),
        settings,
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("welcome-goodbye", data);
    } catch (err) {
      console.error("[Dashboard Welcome Goodbye Page Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to open welcome goodbye page", err);
    }
  });

  app.post("/welcome-goodbye/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      const {
        welcomeEnabled,
        welcomeEmbedEnabled,
        welcomeChannelId,
        welcomeContent,
        welcomeEmbedTitle,
        welcomeEmbedDescription,
        welcomeEmbedColor,
        welcomeEmbedFooter,
        welcomeEmbedThumbnail,
        welcomeEmbedImage,

        goodbyeEnabled,
        goodbyeEmbedEnabled,
        goodbyeChannelId,
        goodbyeContent,
        goodbyeEmbedTitle,
        goodbyeEmbedDescription,
        goodbyeEmbedColor,
        goodbyeEmbedFooter,
        goodbyeEmbedThumbnail,
        goodbyeEmbedImage,

        saveToTemplates,
      } = req.body;

      const welcomeChannel = welcomeChannelId
        ? await client.channels.fetch(welcomeChannelId).catch(() => null)
        : null;

      const goodbyeChannel = goodbyeChannelId
        ? await client.channels.fetch(goodbyeChannelId).catch(() => null)
        : null;

      if (welcomeChannel && welcomeChannel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/welcome-goodbye", { ok: false, message: "Invalid welcome channel selected" });
      }

      if (goodbyeChannel && goodbyeChannel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/welcome-goodbye", { ok: false, message: "Invalid goodbye channel selected" });
      }

      const settings = await DashboardWelcomeGoodbye.findOneAndUpdate(
        { guildId },
        {
          $set: {
            welcomeEnabled: welcomeEnabled === "on",
            welcomeEmbedEnabled: welcomeEmbedEnabled === "on",
            welcomeChannelId: welcomeChannelId || "",
            welcomeChannelName: welcomeChannel?.name || "",
            welcomeContent: welcomeContent?.trim() || "",
            welcomeEmbedTitle: welcomeEmbedTitle?.trim() || "",
            welcomeEmbedDescription: welcomeEmbedDescription?.trim() || "",
            welcomeEmbedColor: welcomeEmbedColor?.trim() || "#8b5cf6",
            welcomeEmbedFooter: welcomeEmbedFooter?.trim() || "",
            welcomeEmbedThumbnail: welcomeEmbedThumbnail?.trim() || "",
            welcomeEmbedImage: welcomeEmbedImage?.trim() || "",

            goodbyeEnabled: goodbyeEnabled === "on",
            goodbyeEmbedEnabled: goodbyeEmbedEnabled === "on",
            goodbyeChannelId: goodbyeChannelId || "",
            goodbyeChannelName: goodbyeChannel?.name || "",
            goodbyeContent: goodbyeContent?.trim() || "",
            goodbyeEmbedTitle: goodbyeEmbedTitle?.trim() || "",
            goodbyeEmbedDescription: goodbyeEmbedDescription?.trim() || "",
            goodbyeEmbedColor: goodbyeEmbedColor?.trim() || "#ff6b6b",
            goodbyeEmbedFooter: goodbyeEmbedFooter?.trim() || "",
            goodbyeEmbedThumbnail: goodbyeEmbedThumbnail?.trim() || "",
            goodbyeEmbedImage: goodbyeEmbedImage?.trim() || "",

            saveToTemplates: saveToTemplates === "on",
          },
        },
        { upsert: true, new: true }
      );

      if (settings.saveToTemplates) {
        if (settings.welcomeEmbedEnabled) {
          await saveEmbedTemplateFromRequest(req, {
            name: "Welcome Embed Style",
            category: "Welcome & Goodbye",
            sourceModule: "welcome-goodbye",
            sourceLabel: "Built from Welcome & Goodbye",
            templateType: "welcome",
            content: settings.welcomeContent,
            embedTitle: settings.welcomeEmbedTitle,
            embedDescription: settings.welcomeEmbedDescription,
            embedColor: settings.welcomeEmbedColor,
            embedFooter: settings.welcomeEmbedFooter,
            embedImage: settings.welcomeEmbedImage,
            embedThumbnail: settings.welcomeEmbedThumbnail,
          });
        }

        if (settings.goodbyeEmbedEnabled) {
          await saveEmbedTemplateFromRequest(req, {
            name: "Goodbye Embed Style",
            category: "Welcome & Goodbye",
            sourceModule: "welcome-goodbye",
            sourceLabel: "Built from Welcome & Goodbye",
            templateType: "goodbye",
            content: settings.goodbyeContent,
            embedTitle: settings.goodbyeEmbedTitle,
            embedDescription: settings.goodbyeEmbedDescription,
            embedColor: settings.goodbyeEmbedColor,
            embedFooter: settings.goodbyeEmbedFooter,
            embedImage: settings.goodbyeEmbedImage,
            embedThumbnail: settings.goodbyeEmbedThumbnail,
          });
        }
      }

      return dashboardJsonOrRedirect(req, res, "/welcome-goodbye", { ok: true, message: "Welcome and goodbye settings saved" });
    } catch (err) {
      console.error("[Dashboard Welcome Goodbye Save Error]", err);
      return redirectWithDashboardError(res, "/welcome-goodbye", "Failed to save welcome goodbye settings", err);
    }
  });

  app.post("/welcome-goodbye/test/:type", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const type = req.params.type;

      if (!["welcome", "goodbye"].includes(type)) {
        return dashboardJsonOrRedirect(req, res, "/welcome-goodbye", { ok: false, message: "Invalid test type" });
      }

      const result = await sendWelcomeGoodbyeTest(req, type);

      if (!result.ok) {
        return res.redirect(`/welcome-goodbye?error=${encodeURIComponent(result.reason)}`);
      }

      return res.redirect(
        `/welcome-goodbye?success=${type === "welcome" ? "Welcome" : "Goodbye"} test sent successfully`
      );
    } catch (err) {
      console.error("[Dashboard Welcome Goodbye Test Error]", err);
      return redirectWithDashboardError(res, "/welcome-goodbye", "Failed to send test message", err);
    }
  });

  app.get("/reaction-roles", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      const panels = await DashboardReactionRolePanel.find({ guildId }).sort({
        createdAt: -1,
      });

      const data = await buildViewData(req, "reaction-roles", {
        channelGroups: await getChannelGroups(req),
        categories: await getGuildCategories(req),
        allChannelGroups: await getAllGuildSelectableChannels(req),
        roles: await getGuildRoles(req),
        panels,
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("reaction-roles", data);
    } catch (err) {
      console.error("[Dashboard Reaction Roles Page Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to open reaction roles page", err);
    }
  });

  app.post("/reaction-roles/create", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      const {
        name,
        channelId,
        content,
        embedEnabled,
        title,
        description,
        color,
        footer,
        thumbnail,
        image,
      } = req.body;

      if (!name?.trim()) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Panel name is required" });
      }

      if (!channelId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Please select a channel" });
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);

      if (!channel || channel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Invalid channel selected" });
      }

      const buttons = await parseReactionRoleButtonsFromRequest(req);
    
      if (!buttons.length) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Add at least one role button" });
      }

      const panel = await DashboardReactionRolePanel.create({
        guildId,
        channelId,
        channelName: channel.name || "",
        messageId: "",
        name: name.trim(),
        content: content?.trim() || "",
        embedEnabled: embedEnabled === "on",
        title: title?.trim() || "Reaction Roles",
        description: description?.trim() || "Click a button below to get or remove a role.",
        color: color?.trim() || "#8b5cf6",
        footer: footer?.trim() || "Click again to remove the role.",
        thumbnail: thumbnail?.trim() || "",
        image: image?.trim() || "",
        buttons,
        active: true,
      });

      const sent = await channel.send(buildReactionRolePanelPayload(panel));

      panel.messageId = sent.id;
      await panel.save();

      return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: true, message: "Reaction role panel sent successfully" });
    } catch (err) {
      console.error("[Dashboard Reaction Roles Create Error]", err);
      return redirectWithDashboardError(res, "/reaction-roles", "Failed to create reaction role panel", err);
    }
  });

  app.post("/reaction-roles/toggle/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const panel = await DashboardReactionRolePanel.findById(req.params.id);

      if (!panel || panel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Panel not found" });
      }

      panel.active = !panel.active;
      await panel.save();

      return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: true, message: "Panel status updated" });
    } catch (err) {
      console.error("[Dashboard Reaction Roles Toggle Error]", err);
      return redirectWithDashboardError(res, "/reaction-roles", "Failed to update panel", err);
    }
  });

  app.post("/reaction-roles/delete/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const panel = await DashboardReactionRolePanel.findById(req.params.id);

      if (!panel || panel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Panel not found" });
      }

      await DashboardReactionRolePanel.findByIdAndDelete(req.params.id);

      return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: true, message: "Panel deleted from dashboard database" });
    } catch (err) {
      console.error("[Dashboard Reaction Roles Delete Error]", err);
      return redirectWithDashboardError(res, "/reaction-roles", "Failed to delete panel", err);
    }
  });

    app.get("/reaction-roles/edit/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const panel = await DashboardReactionRolePanel.findById(req.params.id);

      if (!panel || panel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Panel not found" });
      }

      const data = await buildViewData(req, "reaction-roles", {
        channelGroups: await getChannelGroups(req),
        categories: await getGuildCategories(req),
        allChannelGroups: await getAllGuildSelectableChannels(req),
        roles: await getGuildRoles(req),
        panel,
        panelButtonsJson: JSON.stringify(panel.buttons || []),
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("reaction-role-edit", data);
    } catch (err) {
      console.error("[Dashboard Reaction Roles Edit Page Error]", err);
      return redirectWithDashboardError(res, "/reaction-roles", "Failed to open panel editor", err);
    }
  });

  app.post("/reaction-roles/update/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const panel = await DashboardReactionRolePanel.findById(req.params.id);

      if (!panel || panel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Panel not found" });
      }

      const {
        name,
        channelId,
        content,
        embedEnabled,
        title,
        description,
        color,
        footer,
        thumbnail,
        image,
      } = req.body;
      
      if (!name?.trim()) {
        return res.redirect(`/reaction-roles/edit/${panel._id}?error=Panel name is required`);
      }

      if (!channelId) {
        return res.redirect(`/reaction-roles/edit/${panel._id}?error=Please select a channel`);
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);

      if (!channel || channel.guildId !== guildId) {
        return res.redirect(`/reaction-roles/edit/${panel._id}?error=Invalid channel selected`);
      }

      const buttons = await parseReactionRoleButtonsFromRequest(req);

      if (!buttons.length) {
        return res.redirect(`/reaction-roles/edit/${panel._id}?error=Add at least one role button`);
      }

      panel.name = name.trim();
      panel.channelId = channelId;
      panel.channelName = channel.name || "";
      panel.content = content?.trim() || "";
      panel.embedEnabled = embedEnabled === "on";
      panel.title = title?.trim() || "Reaction Roles";
      panel.description = description?.trim() || "Click a button below to get or remove a role.";
      panel.color = color?.trim() || "#8b5cf6";
      panel.footer = footer?.trim() || "Click again to remove the role.";
      panel.thumbnail = thumbnail?.trim() || "";
      panel.image = image?.trim() || "";
      panel.buttons = buttons;

      await panel.save();

      if (panel.messageId) {
        const oldChannel = await client.channels.fetch(panel.channelId).catch(() => null);
        const oldMessage = oldChannel
          ? await oldChannel.messages.fetch(panel.messageId).catch(() => null)
          : null;

        if (oldMessage) {
          await oldMessage.edit(buildReactionRolePanelPayload(panel));
        }
      }

      return res.redirect(`/reaction-roles/edit/${panel._id}?success=Panel updated successfully`);
    } catch (err) {
      console.error("[Dashboard Reaction Roles Update Error]", err);
      return redirectWithDashboardError(res, "/reaction-roles", "Failed to update panel", err);
    }
  });

  app.post("/reaction-roles/refresh/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const panel = await DashboardReactionRolePanel.findById(req.params.id);

      if (!panel || panel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Panel not found" });
      }

      if (!panel.messageId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Panel has no Discord message saved. Use Resend instead." });
      }

      const channel = await client.channels.fetch(panel.channelId).catch(() => null);

      if (!channel || channel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Panel channel was not found" });
      }

      const message = await channel.messages.fetch(panel.messageId).catch(() => null);

      if (!message) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Original Discord message was not found. Use Resend to create a new one." });
      }

      await message.edit(buildReactionRolePanelPayload(panel));

      return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: true, message: "Panel refreshed successfully" });
    } catch (err) {
      console.error("[Dashboard Reaction Roles Refresh Error]", err);
      return redirectWithDashboardError(res, "/reaction-roles", "Failed to refresh panel", err);
    }
  });

    app.post("/reaction-roles/resend/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const panel = await DashboardReactionRolePanel.findById(req.params.id);

      if (!panel || panel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Panel not found" });
      }

      const channel = await client.channels.fetch(panel.channelId).catch(() => null);

      if (!channel || channel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: false, message: "Panel channel was not found" });
      }

      const sent = await channel.send(buildReactionRolePanelPayload(panel));

      panel.messageId = sent.id;
      panel.active = true;
      await panel.save();

      return dashboardJsonOrRedirect(req, res, "/reaction-roles", { ok: true, message: "Panel resent successfully" });
    } catch (err) {
      console.error("[Dashboard Reaction Roles Resend Error]", err);
      return redirectWithDashboardError(res, "/reaction-roles", "Failed to resend panel", err);
    }
  });

  app.get("/levels", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      let config = await DashboardLevelsConfig.findOne({ guildId });

      if (!config) {
        config = await DashboardLevelsConfig.create({ guildId });
      }

      const topLevelUsers = await DashboardLevelUser.find({ guildId })
        .sort({ xp: -1 })
        .limit(25);

      const data = await buildViewData(req, "levels", {
        channelGroups: await getChannelGroups(req),
        categories: await getGuildCategories(req),
        allChannelGroups: await getAllGuildSelectableChannels(req),
        roles: await getGuildRoles(req),
        config,
        topLevelUsers,
        rewardsJson: JSON.stringify(config.rewards || []),
        ignoredChannelsJson: JSON.stringify(config.ignoredChannels || []),
        noXpRolesJson: JSON.stringify(config.noXpRoles || []),
        multiplierRolesJson: JSON.stringify(config.multiplierRoles || []),
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("levels", data);
    } catch (err) {
      console.error("[Dashboard Levels Page Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to open levels page", err);
    }
  });

  app.post("/levels/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      const {
        enabled,
        levelUpChannelId,
        sendLevelUpMessage,
        levelUpContent,
        embedEnabled,
        embedTitle,
        embedDescription,
        embedColor,
        embedFooter,
        embedThumbnail,
        embedImage,
        minXp,
        maxXp,
        cooldownSeconds,
      } = req.body;

      const levelUpChannel = levelUpChannelId
        ? await client.channels.fetch(levelUpChannelId).catch(() => null)
        : null;

      if (levelUpChannel && levelUpChannel.guildId !== guildId) {
        return dashboardJsonOrRedirect(req, res, "/levels", { ok: false, message: "Invalid level-up channel selected" });
      }

      const cleanMinXp = Math.max(1, Number(minXp || 15));
      const cleanMaxXp = Math.max(cleanMinXp, Number(maxXp || 25));
      const cleanCooldown = Math.max(5, Number(cooldownSeconds || 60));
      const rewards = await parseLevelRewardsFromRequest(req);
      const ignoredChannels = await parseIgnoredChannelsFromRequest(req);
      const noXpRoles = await parseNoXpRolesFromRequest(req);
      const multiplierRoles = await parseMultiplierRolesFromRequest(req);

      await DashboardLevelsConfig.findOneAndUpdate(
        { guildId },
        {
          $set: {
            enabled: enabled === "on",
            levelUpChannelId: levelUpChannelId || "",
            levelUpChannelName: levelUpChannel?.name || "",
            sendLevelUpMessage: sendLevelUpMessage === "on",
            levelUpContent: levelUpContent?.trim() || "",
            embedEnabled: embedEnabled === "on",
            embedTitle: embedTitle?.trim() || "🏆 Level Up!",
            embedDescription:
              embedDescription?.trim() || "{user} has reached **Level {level}** in **{server}**!",
            embedColor: embedColor?.trim() || "#8b5cf6",
            embedFooter: embedFooter?.trim() || "Keep chatting to level up!",
            embedThumbnail: embedThumbnail?.trim() || "",
            embedImage: embedImage?.trim() || "",
            minXp: cleanMinXp,
            maxXp: cleanMaxXp,
            cooldownSeconds: cleanCooldown,
            rewards,
            ignoredChannels,
            noXpRoles,
            multiplierRoles,
          },
        },
        { upsert: true, new: true }
      );

      return dashboardJsonOrRedirect(req, res, "/levels", { ok: true, message: "Levels settings saved successfully" });
    } catch (err) {
      console.error("[Dashboard Levels Save Error]", err);
      return redirectWithDashboardError(res, "/levels", "Failed to save levels settings", err);
    }
  });

    app.post("/levels/add-xp", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const guild = getSelectedGuild(req);

      const { userInput, amount } = req.body;

      const member = await resolveDashboardMember(guild, userInput);
      if (!member) {
        return dashboardJsonOrRedirect(req, res, "/levels", { ok: false, message: "Could not find that member" });
      }

      const cleanAmount = Math.max(1, Number(amount || 0));
      if (!cleanAmount) {
        return dashboardJsonOrRedirect(req, res, "/levels", { ok: false, message: "Enter a valid XP amount" });
      }

      let levelUser = await DashboardLevelUser.findOne({
        guildId,
        userId: member.id,
      });

      if (!levelUser) {
        levelUser = await DashboardLevelUser.create({
          guildId,
          userId: member.id,
          username: member.user.username,
          xp: 0,
          level: 0,
          lastXpAt: 0,
        });
      }

      levelUser.username = member.user.username;
      levelUser.xp = Number(levelUser.xp || 0) + cleanAmount;
      levelUser.level = calculateDashboardLevelFromXp(levelUser.xp);
      await levelUser.save();

      return res.redirect(`/levels?success=Added ${cleanAmount} XP to ${encodeURIComponent(member.user.username)}`);
    } catch (err) {
      console.error("[Dashboard Levels Add XP Error]", err);
      return redirectWithDashboardError(res, "/levels", "Failed to add XP", err);
    }
  });

  app.post("/levels/remove-xp", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const guild = getSelectedGuild(req);

      const { userInput, amount } = req.body;

      const member = await resolveDashboardMember(guild, userInput);
      if (!member) {
        return dashboardJsonOrRedirect(req, res, "/levels", { ok: false, message: "Could not find that member" });
      }

      const cleanAmount = Math.max(1, Number(amount || 0));
      if (!cleanAmount) {
        return dashboardJsonOrRedirect(req, res, "/levels", { ok: false, message: "Enter a valid XP amount" });
      }

      let levelUser = await DashboardLevelUser.findOne({
        guildId,
        userId: member.id,
      });

      if (!levelUser) {
        return dashboardJsonOrRedirect(req, res, "/levels", { ok: false, message: "That member has no XP data yet" });
      }

      levelUser.username = member.user.username;
      levelUser.xp = Math.max(0, Number(levelUser.xp || 0) - cleanAmount);
      levelUser.level = calculateDashboardLevelFromXp(levelUser.xp);
      await levelUser.save();

      return res.redirect(`/levels?success=Removed ${cleanAmount} XP from ${encodeURIComponent(member.user.username)}`);
    } catch (err) {
      console.error("[Dashboard Levels Remove XP Error]", err);
      return redirectWithDashboardError(res, "/levels", "Failed to remove XP", err);
    }
  });

  app.post("/levels/set-xp", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const guild = getSelectedGuild(req);

      const { userInput, amount } = req.body;

      const member = await resolveDashboardMember(guild, userInput);
      if (!member) {
        return dashboardJsonOrRedirect(req, res, "/levels", { ok: false, message: "Could not find that member" });
      }

      const cleanAmount = Math.max(0, Number(amount || 0));

      let levelUser = await DashboardLevelUser.findOne({
        guildId,
        userId: member.id,
      });

      if (!levelUser) {
        levelUser = await DashboardLevelUser.create({
          guildId,
          userId: member.id,
          username: member.user.username,
          xp: 0,
          level: 0,
          lastXpAt: 0,
        });
      }

      levelUser.username = member.user.username;
      levelUser.xp = cleanAmount;
      levelUser.level = calculateDashboardLevelFromXp(levelUser.xp);
      await levelUser.save();

      return res.redirect(`/levels?success=Set XP for ${encodeURIComponent(member.user.username)}`);
    } catch (err) {
      console.error("[Dashboard Levels Set XP Error]", err);
      return redirectWithDashboardError(res, "/levels", "Failed to set XP", err);
    }
  });

  app.post("/levels/set-level", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const guild = getSelectedGuild(req);

      const { userInput, level } = req.body;

      const member = await resolveDashboardMember(guild, userInput);
      if (!member) {
        return dashboardJsonOrRedirect(req, res, "/levels", { ok: false, message: "Could not find that member" });
      }

      const cleanLevel = Math.max(0, Number(level || 0));
      const xpForLevel = Math.ceil(xpNeededForDashboardLevel(cleanLevel));

      let levelUser = await DashboardLevelUser.findOne({
        guildId,
        userId: member.id,
      });

      if (!levelUser) {
        levelUser = await DashboardLevelUser.create({
          guildId,
          userId: member.id,
          username: member.user.username,
          xp: 0,
          level: 0,
          lastXpAt: 0,
        });
      }

      levelUser.username = member.user.username;
      levelUser.level = cleanLevel;
      levelUser.xp = xpForLevel;
      await levelUser.save();

      return res.redirect(`/levels?success=Set level for ${encodeURIComponent(member.user.username)}`);
    } catch (err) {
      console.error("[Dashboard Levels Set Level Error]", err);
      return redirectWithDashboardError(res, "/levels", "Failed to set level", err);
    }
  });

    app.post("/levels/reset-user/:userId", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const userId = req.params.userId;

      await DashboardLevelUser.findOneAndDelete({ guildId, userId });

      return dashboardJsonOrRedirect(req, res, "/levels", { ok: true, message: "User XP reset successfully" });
    } catch (err) {
      console.error("[Dashboard Levels Reset User Error]", err);
      return redirectWithDashboardError(res, "/levels", "Failed to reset user XP", err);
    }
  });

  app.post("/levels/reset-all", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);

      await DashboardLevelUser.deleteMany({ guildId });

      return dashboardJsonOrRedirect(req, res, "/levels", { ok: true, message: "All XP data reset successfully" });
    } catch (err) {
      console.error("[Dashboard Levels Reset All Error]", err);
      return redirectWithDashboardError(res, "/levels", "Failed to reset all XP data", err);
    }
  });
  
  app.get("/starboards", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const config = (await modelFindOneSafe(DashboardStarboardConfig, { guildId })) || new DashboardStarboardConfig({ guildId });
      const data = await buildViewData(req, "starboards", {
        channelGroups: await getChannelGroups(req),
        config,
        success: req.query.success || null,
        error: req.query.error || null,
      });
      return res.render("starboards", data);
    } catch (err) {
      console.error("[Dashboard Starboards Page Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to open starboards", err);
    }
  });

  app.post("/starboards/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const { enabled, starboardChannelId, emoji, threshold } = req.body;
      const channel = starboardChannelId ? await client.channels.fetch(starboardChannelId).catch(() => null) : null;
      if (starboardChannelId && (!channel || channel.guildId !== guildId)) {
        return dashboardJsonOrRedirect(req, res, "/starboards", { ok: false, message: "Invalid starboard channel selected" });
      }
      await DashboardStarboardConfig.findOneAndUpdate(
        { guildId },
        { $set: {
          enabled: enabled === "on",
          starboardChannelId: starboardChannelId || "",
          starboardChannelName: channel?.name || "",
          emoji: (emoji || "⭐").trim() || "⭐",
          threshold: cleanDashboardNumber(threshold, 3, 1, 50),
        }},
        { upsert: true, new: true }
      );
      return dashboardJsonOrRedirect(req, res, "/starboards", { ok: true, message: "Starboard settings saved" });
    } catch (err) {
      console.error("[Dashboard Starboards Save Error]", err);
      return redirectWithDashboardError(res, "/starboards", "Failed to save starboard settings", err);
    }
  });

  app.get("/moderation", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      let config = await ModerationConfig.findOne({ guildId });
      if (!config) config = await ModerationConfig.create({ guildId });
      const recentCases = await ModerationCase.find({ guildId }).sort({ createdAt: -1 }).limit(20);
      const warningCount = await ModerationWarning.countDocuments({ guildId });
      const noteCount = await ModerationNote.countDocuments({ guildId });
      const vcBanCount = await ModerationVcBan.countDocuments({ guildId, active: true });
      const data = await buildViewData(req, "moderation", {
        channelGroups: await getChannelGroups(req),
        categories: await getGuildCategories(req),
        allChannelGroups: await getAllGuildSelectableChannels(req),
        roles: await getGuildRoles(req),
        config,
        recentCases,
        warningCount,
        noteCount,
        vcBanCount,
        success: req.query.success || null,
        error: req.query.error || null,
      });
      return res.render("moderation", data);
    } catch (err) {
      console.error("[Dashboard Moderation Page Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to open moderation page", err);
    }
  });

  app.post("/moderation/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const {
        logChannelId,
        welcomeChannelId,
        verifyChannelId,
        verifyRoleId,
        automodEnabled,
        antiLinkEnabled,
        antiSpamEnabled,
        antiRaidEnabled,
        spamMaxMessages,
        spamWindowSeconds,
        spamTimeoutMinutes,
        raidJoinLimit,
        raidWindowSeconds,
      } = req.body;

      const logChannel = logChannelId ? await client.channels.fetch(logChannelId).catch(() => null) : null;
      const welcomeChannel = welcomeChannelId ? await client.channels.fetch(welcomeChannelId).catch(() => null) : null;
      const verifyChannel = verifyChannelId ? await client.channels.fetch(verifyChannelId).catch(() => null) : null;
      const guild = getSelectedGuild(req);
      await guild.roles.fetch().catch(() => null);
      const verifyRole = verifyRoleId ? guild.roles.cache.get(verifyRoleId) : null;

      for (const channel of [logChannel, welcomeChannel, verifyChannel].filter(Boolean)) {
        if (channel.guildId !== guildId) return dashboardJsonOrRedirect(req, res, "/moderation", { ok: false, message: "Invalid channel selected" });
      }

      await ModerationConfig.findOneAndUpdate(
        { guildId },
        {
          $set: {
            logChannelId: logChannelId || "",
            logChannelName: logChannel?.name || "",
            welcomeChannelId: welcomeChannelId || "",
            welcomeChannelName: welcomeChannel?.name || "",
            verifyChannelId: verifyChannelId || "",
            verifyChannelName: verifyChannel?.name || "",
            verifyRoleId: verifyRoleId || "",
            verifyRoleName: verifyRole?.name || "",
            automodEnabled: automodEnabled === "on",
            antiLinkEnabled: antiLinkEnabled === "on",
            antiSpamEnabled: antiSpamEnabled === "on",
            antiRaidEnabled: antiRaidEnabled === "on",
            spamMaxMessages: cleanDashboardNumber(spamMaxMessages, 5, 2, 20),
            spamWindowSeconds: cleanDashboardNumber(spamWindowSeconds, 8, 3, 60),
            spamTimeoutMinutes: cleanDashboardNumber(spamTimeoutMinutes, 10, 1, 40320),
            raidJoinLimit: cleanDashboardNumber(raidJoinLimit, 8, 3, 100),
            raidWindowSeconds: cleanDashboardNumber(raidWindowSeconds, 60, 10, 600),
          },
        },
        { upsert: true, new: true }
      );
      return dashboardJsonOrRedirect(req, res, "/moderation", { ok: true, message: "Moderation settings saved" });
    } catch (err) {
      console.error("[Dashboard Moderation Save Error]", err);
      return redirectWithDashboardError(res, "/moderation", "Failed to save moderation settings", err);
    }
  });

  app.post("/moderation/action", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const { action, userInput, reason, timeoutMinutes, deleteMessageDays, noteText } = req.body;
      const cleanReason = reason?.trim() || noteText?.trim() || "No reason provided from dashboard";
      const member = await resolveDashboardMember(guild, userInput);
      const userId = userInput ? String(userInput).trim().replace(/[<@!>]/g, "") : "";

      let targetUser = member?.user || (userId ? await client.users.fetch(userId).catch(() => null) : null);
      if (!member && !["hackban"].includes(action)) return dashboardJsonOrRedirect(req, res, "/moderation", { ok: false, message: "Could not find that member" });
      if (!targetUser) return dashboardJsonOrRedirect(req, res, "/moderation", { ok: false, message: "Could not resolve that user" });

      let caseAction = action.toUpperCase();
      if (action === "warn") {
        const c = await ModerationCase.create({ guildId: guild.id, caseId: ((await ModerationCase.findOne({ guildId: guild.id }).sort({ caseId: -1 }))?.caseId || 0) + 1, action: "WARN", targetId: targetUser.id, targetTag: targetUser.tag, moderatorTag: "Dashboard", reason: cleanReason });
        await ModerationWarning.create({ guildId: guild.id, userId: targetUser.id, username: targetUser.username, moderatorTag: "Dashboard", reason: cleanReason, caseId: c.caseId });
      } else if (action === "note") {
        await ModerationNote.create({ guildId: guild.id, userId: targetUser.id, username: targetUser.username, moderatorTag: "Dashboard", text: cleanReason });
      } else if (action === "timeout") {
        await member.timeout(cleanDashboardNumber(timeoutMinutes, 10, 1, 40320) * 60 * 1000, cleanReason);
      } else if (action === "unmute") {
        await member.timeout(null, cleanReason);
      } else if (action === "kick") {
        await member.kick(cleanReason);
      } else if (action === "ban") {
        await guild.members.ban(targetUser.id, { reason: cleanReason, deleteMessageSeconds: cleanDashboardNumber(deleteMessageDays, 0, 0, 7) * 86400 });
      } else if (action === "hackban") {
        await guild.members.ban(targetUser.id, { reason: cleanReason });
      } else if (action === "vcban") {
        await ModerationVcBan.findOneAndUpdate({ guildId: guild.id, userId: targetUser.id }, { guildId: guild.id, userId: targetUser.id, username: targetUser.username, moderatorTag: "Dashboard", reason: cleanReason, active: true }, { upsert: true });
      } else if (action === "unvcban") {
        await ModerationVcBan.findOneAndDelete({ guildId: guild.id, userId: targetUser.id });
      } else {
        return dashboardJsonOrRedirect(req, res, "/moderation", { ok: false, message: "Invalid moderation action" });
      }

      const latest = await ModerationCase.findOne({ guildId: guild.id }).sort({ caseId: -1 });
      await ModerationCase.create({ guildId: guild.id, caseId: (latest?.caseId || 0) + 1, action: caseAction, targetId: targetUser.id, targetTag: targetUser.tag, moderatorTag: "Dashboard", reason: cleanReason }).catch(() => null);
      return res.redirect(`/moderation?success=${encodeURIComponent(caseAction)} completed for ${encodeURIComponent(targetUser.username)}`);
    } catch (err) {
      console.error("[Dashboard Moderation Action Error]", err);
      return redirectWithDashboardError(res, "/moderation", "Failed to run moderation action", err);
    }
  });

  app.post("/moderation/clear-history", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      await ModerationCase.deleteMany({ guildId });
      return dashboardJsonOrRedirect(req, res, "/moderation", { ok: true, message: "Moderation history cleared" });
    } catch (err) {
      console.error("[Dashboard Moderation Clear History Error]", err);
      return redirectWithDashboardError(res, "/moderation", "Failed to clear moderation history", err);
    }
  });

  app.get("/automations", requireAuth, requireSelectedGuild, async (req, res) => {
    const guildId = getGuildId(req);
    const jobs = (
      await modelFindSafe(
        DashboardAutoMessage,
        { guildId },
        null,
        { sort: { createdAt: -1 }, limit: 20 }
      )
    );
    const data = await buildViewData(req, "automations", {
      channelGroups: await getChannelGroups(req),
      jobs,
      success: req.query.success || null,
      error: req.query.error || null,
    });
    return res.render("automations", data);
  });

  app.post("/automations/create", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const { name, channelId, content, intervalHours } = req.body;
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.guildId !== guildId) return dashboardJsonOrRedirect(req, res, "/automations", { ok: false, message: "Invalid channel selected" });
      if (!content?.trim()) return dashboardJsonOrRedirect(req, res, "/automations", { ok: false, message: "Automation message cannot be empty" });
      const job = await DashboardAutoMessage.create({
        guildId,
        channelId,
        channelName: channel.name || "unknown-channel",
        name: name?.trim() || "Automation",
        content: content.trim(),
        intervalHours: cleanDashboardNumber(intervalHours, 12, 1, 720),
        active: true,
      });
      startAutoMessageJob(job);
      return dashboardJsonOrRedirect(req, res, "/automations", { ok: true, message: "Automation created and started" });
    } catch (err) {
      console.error("[Dashboard Automation Create Error]", err);
      return redirectWithDashboardError(res, "/automations", "Failed to create automation", err);
    }
  });

  app.get("/custom-commands", requireAuth, requireSelectedGuild, async (req, res) => {
    const guildId = getGuildId(req);
    const commands = await modelFindSafe(
      DashboardCustomCommand,
      { guildId },
      null,
      { sort: { createdAt: -1 } }
    );
    const data = await buildViewData(req, "custom-commands", {
      commands,
      success: req.query.success || null,
      error: req.query.error || null,
    });
    return res.render("custom-commands", data);
  });

  app.post("/custom-commands/create", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const { trigger, response, embedEnabled, embedTitle, embedDescription, embedColor } = req.body;
      const cleanTrigger = String(trigger || "").trim().toLowerCase().replace(/^[$/!]+/, "");
      if (!cleanTrigger) return dashboardJsonOrRedirect(req, res, "/custom-commands", { ok: false, message: "Command trigger is required" });
      if (!response?.trim() && !embedDescription?.trim()) return dashboardJsonOrRedirect(req, res, "/custom-commands", { ok: false, message: "Response or embed description is required" });
      await DashboardCustomCommand.findOneAndUpdate(
        { guildId, trigger: cleanTrigger },
        { $set: {
          response: response?.trim() || "",
          embedEnabled: embedEnabled === "on",
          embedTitle: embedTitle?.trim() || "",
          embedDescription: embedDescription?.trim() || "",
          embedColor: embedColor?.trim() || "#8b5cf6",
          enabled: true,
        }},
        { upsert: true, new: true }
      );
      return dashboardJsonOrRedirect(req, res, "/custom-commands", { ok: true, message: "Custom command saved" });
    } catch (err) {
      console.error("[Dashboard Custom Command Save Error]", err);
      return redirectWithDashboardError(res, "/custom-commands", "Failed to save custom command", err);
    }
  });

  app.post("/custom-commands/toggle/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const cmd = await DashboardCustomCommand.findById(req.params.id);
      if (!cmd || cmd.guildId !== guildId) return dashboardJsonOrRedirect(req, res, "/custom-commands", { ok: false, message: "Command not found" });
      cmd.enabled = !cmd.enabled;
      await cmd.save();
      return dashboardJsonOrRedirect(req, res, "/custom-commands", { ok: true, message: "Command status updated" });
    } catch (err) {
      console.error("[Dashboard Custom Command Toggle Error]", err);
      return redirectWithDashboardError(res, "/custom-commands", "Failed to update custom command", err);
    }
  });

  app.post("/custom-commands/delete/:id", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const cmd = await DashboardCustomCommand.findById(req.params.id);
      if (!cmd || cmd.guildId !== guildId) return dashboardJsonOrRedirect(req, res, "/custom-commands", { ok: false, message: "Command not found" });
      await DashboardCustomCommand.findByIdAndDelete(req.params.id);
      return dashboardJsonOrRedirect(req, res, "/custom-commands", { ok: true, message: "Command deleted" });
    } catch (err) {
      console.error("[Dashboard Custom Command Delete Error]", err);
      return redirectWithDashboardError(res, "/custom-commands", "Failed to delete custom command", err);
    }
  });

  app.get("/ticketing", requireAuth, requireSelectedGuild, async (req, res) => {
    const guildId = getGuildId(req);
    const config = (await modelFindOneSafe(DashboardTicketConfig, { guildId })) || new DashboardTicketConfig({ guildId });
    const data = await buildViewData(req, "ticketing", {
      channelGroups: await getChannelGroups(req),
      roles: await getGuildRoles(req),
      config,
      success: req.query.success || null,
      error: req.query.error || null,
    });
    return res.render("ticketing", data);
  });

  app.post("/ticketing/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const {
        enabled,
        panelChannelId,
        categoryId,
        supportRoleId,
        logChannelId,
        panelTitle,
        panelDescription,
        panelColor,
        panelFooter,
        panelThumbnail,
        panelImage,
        buttonLabel,
        buttonEmoji,
        buttonStyle,
        ticketWelcomeTitle,
        ticketWelcomeMessage,
        ticketNameFormat,
        autoCloseHours,
        maxOpenTicketsPerUser,
        transcriptEnabled,
        dmUserOnOpen,
        dmUserOnClose,
        staffPingOnOpen,
        aiPrecheckEnabled,
      } = req.body;

      const channel = panelChannelId ? await client.channels.fetch(panelChannelId).catch(() => null) : null;
      if (panelChannelId && (!channel || channel.guildId !== guildId)) {
        return dashboardJsonOrRedirect(req, res, "/ticketing", { ok: false, message: "Invalid panel channel selected" });
      }

      const logChannel = logChannelId ? await client.channels.fetch(logChannelId).catch(() => null) : null;
      if (logChannelId && (!logChannel || logChannel.guildId !== guildId)) {
        return dashboardJsonOrRedirect(req, res, "/ticketing", { ok: false, message: "Invalid log channel selected" });
      }

      const guild = getSelectedGuild(req);
      await guild.roles.fetch().catch(() => null);
      const role = supportRoleId ? guild.roles.cache.get(supportRoleId) : null;
      const allowedButtonStyles = ["Primary", "Secondary", "Success", "Danger"];

      await DashboardTicketConfig.findOneAndUpdate(
        { guildId },
        { $set: {
          enabled: enabled === "on",
          panelChannelId: panelChannelId || "",
          panelChannelName: channel?.name || "",
          categoryId: categoryId || "",
          supportRoleId: role?.id || "",
          supportRoleName: role?.name || "",
          logChannelId: logChannel?.id || "",
          logChannelName: logChannel?.name || "",
          panelTitle: panelTitle?.trim() || "🎫 Open a Ticket",
          panelDescription: panelDescription?.trim() || "Click the button below to open a support ticket.",
          panelColor: cleanDashboardHex(panelColor, "#8b5cf6"),
          panelFooter: panelFooter?.trim() || "Legendary Bot Ticket System",
          panelThumbnail: panelThumbnail?.trim() || "",
          panelImage: panelImage?.trim() || "",
          buttonLabel: buttonLabel?.trim() || "Open Ticket",
          buttonEmoji: buttonEmoji?.trim() || "🎫",
          buttonStyle: allowedButtonStyles.includes(buttonStyle) ? buttonStyle : "Primary",
          ticketWelcomeTitle: ticketWelcomeTitle?.trim() || "Welcome to your ticket",
          ticketWelcomeMessage: ticketWelcomeMessage?.trim() || "Thanks for opening a ticket! Please explain your issue clearly and staff will help you soon.",
          ticketNameFormat: ticketNameFormat?.trim() || "ticket-{username}",
          autoCloseHours: Math.max(0, Math.min(720, Number(autoCloseHours || 0))),
          maxOpenTicketsPerUser: Math.max(1, Math.min(20, Number(maxOpenTicketsPerUser || 1))),
          transcriptEnabled: transcriptEnabled === "on",
          dmUserOnOpen: dmUserOnOpen === "on",
          dmUserOnClose: dmUserOnClose === "on",
          staffPingOnOpen: staffPingOnOpen === "on",
          aiPrecheckEnabled: aiPrecheckEnabled === "on",
        }},
        { upsert: true, new: true }
      );
      return dashboardJsonOrRedirect(req, res, "/ticketing", { ok: true, message: "Ticket settings saved" });
    } catch (err) {
      console.error("[Dashboard Ticket Save Error]", err);
      return redirectWithDashboardError(res, "/ticketing", "Failed to save ticket settings", err);
    }
  });

  app.post("/ticketing/send-panel", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const config = await modelFindOneSafe(DashboardTicketConfig, { guildId });
      if (!config || !config.panelChannelId) return dashboardJsonOrRedirect(req, res, "/ticketing", { ok: false, message: "Save a panel channel first" });
      const channel = await client.channels.fetch(config.panelChannelId).catch(() => null);
      if (!channel || channel.guildId !== guildId) return dashboardJsonOrRedirect(req, res, "/ticketing", { ok: false, message: "Saved panel channel was not found" });
      const embed = new EmbedBuilder()
        .setTitle(config.panelTitle || "🎫 Open a Ticket")
        .setDescription(config.panelDescription || "Click the button below to open a support ticket.")
        .setColor(cleanDashboardHex(config.panelColor, "#8b5cf6"));

      if (config.panelFooter) embed.setFooter({ text: config.panelFooter });
      if (config.panelThumbnail) embed.setThumbnail(config.panelThumbnail);
      if (config.panelImage) embed.setImage(config.panelImage);

      const ticketButton = new ButtonBuilder()
        .setCustomId("ticket_open")
        .setLabel(config.buttonLabel || "Open Ticket")
        .setStyle(dashboardButtonStyle(config.buttonStyle || "Primary"));

      if (config.buttonEmoji) ticketButton.setEmoji(config.buttonEmoji);

      const row = new ActionRowBuilder().addComponents(ticketButton);
      await channel.send({ embeds: [embed], components: [row] });
      return dashboardJsonOrRedirect(req, res, "/ticketing", { ok: true, message: "Ticket panel sent successfully" });
    } catch (err) {
      console.error("[Dashboard Ticket Panel Error]", err);
      return redirectWithDashboardError(res, "/ticketing", "Failed to send ticket panel", err);
    }
  });



  // Owner-friendly aliases for AI Tickets panel.
  
  function buildAITicketTypesFromBody(body = {}, existingTypes = []) {
    const baseTypes = typeof AITicketConfig.normalizeTypes === "function"
      ? AITicketConfig.normalizeTypes(existingTypes || [])
      : (Array.isArray(existingTypes) ? existingTypes : []);

    return baseTypes.map((type) => ({
      key: String(type.key || "").trim(),
      label: String(type.label || type.key || "").trim(),
      enabled: body[`${type.key}_enabled`] === "on",
      categoryId: String(body[`${type.key}_categoryId`] || "").trim(),
      reviewChannelId: String(body[`${type.key}_reviewChannelId`] || "").trim(),
      pingRoleId: String(body[`${type.key}_pingRoleId`] || "").trim(),
    }));
  }

  async function getOrCreateAITicketDashboardConfig(guildId, guild) {
    let config = await modelFindOneSafe(AITicketConfig, { guildId });
    const normalizedTypes = typeof AITicketConfig.normalizeTypes === "function"
      ? AITicketConfig.normalizeTypes(config?.types || [])
      : (config?.types || []);

    if (!config) {
      return AITicketConfig.findOneAndUpdate(
        { guildId },
        {
          $setOnInsert: {
            guildId,
            guildName: guild?.name || "",
          },
          $set: {
            guildName: guild?.name || "",
            types: normalizedTypes,
            updatedAt: new Date(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    const rawTypes = (config.types || []).map((item) => (typeof item?.toObject === "function" ? item.toObject() : item));
    if (JSON.stringify(rawTypes) !== JSON.stringify(normalizedTypes) || config.guildName !== (guild?.name || config.guildName || "")) {
      config = await AITicketConfig.findOneAndUpdate(
        { guildId },
        {
          $set: {
            guildName: guild?.name || config.guildName || "",
            types: normalizedTypes,
            updatedAt: new Date(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    return config;
  }

app.get("/server-management/ai-tickets", requireAuth, requireSelectedGuild, (req, res) => {
    return res.redirect("/ai-tickets");
  });


  async function getOrCreateAiMentionChatDashboardConfig(guildId, guild) {
    let config = await AiMentionChatConfig.findOne({ guildId });

    if (!config) {
      config = await AiMentionChatConfig.findOneAndUpdate(
        { guildId },
        {
          $setOnInsert: {
            guildId,
            guildName: guild?.name || "",
          },
          $set: {
            guildName: guild?.name || "",
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    return aiMentionChatManager.sanitizeConfig(config, guild);
  }

  function parseAiChatChannelList(value) {
    try {
      const parsed = JSON.parse(String(value || "[]"));
      if (!Array.isArray(parsed)) return [];
      return parsed.map(String).filter(Boolean).slice(0, 100);
    } catch {
      return [];
    }
  }

  function parseAiChatRoleLimits(value, guild) {
    try {
      const parsed = JSON.parse(String(value || "[]"));
      if (!Array.isArray(parsed)) return [];

      const roles = guild?.roles?.cache || new Map();

      return parsed
        .map((item) => {
          const roleId = String(item.roleId || "").trim();
          const role = roles.get(roleId);
          if (!roleId || !role) return null;

          return {
            roleId,
            roleName: role.name,
            dailyLimit: Math.max(0, Math.min(10000, Number(item.dailyLimit || 0))),
            unlimited: Boolean(item.unlimited),
          };
        })
        .filter(Boolean)
        .slice(0, 100);
    } catch {
      return [];
    }
  }

  app.get("/owner/:guildId/ai-chat", requireAuth, async (req, res) => {
    try {
      req.session.selectedGuildId = req.params.guildId;
      req.session.loginRole = "dashboard";
      req.session.loggedIn = true;
      req.session.ownerLoggedIn = true;
      req.session.scopedRouteBase = `/owner/${req.params.guildId}`;

      const guild = getSelectedGuild(req);
      const guildId = getGuildId(req);

      const config = await getOrCreateAiMentionChatDashboardConfig(guildId, guild);

      const data = await buildViewData(req, "ai-chat", {
        config,
        channelGroups: await getChannelGroups(req).catch(() => []),
        roles: await getGuildRoles(req).catch(() => []),
        pageTitle: "AI Session Chat",
        pageSubtitle: "Wake-up AI chat, role limits, idle sleep, stop command, and saved MongoDB settings.",
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("ai-chat", data);
    } catch (err) {
      console.error("[Owner AI Chat Page Error]", err?.stack || err?.message || err);
      return sendDashboardError(req, res, "/dashboard", "Failed to load AI chat settings", err, 500);
    }
  });

  app.get("/ai-chat", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const guildId = getGuildId(req);

      const config = await getOrCreateAiMentionChatDashboardConfig(guildId, guild);

      const data = await buildViewData(req, "ai-chat", {
        config,
        channelGroups: await getChannelGroups(req).catch(() => []),
        roles: await getGuildRoles(req).catch(() => []),
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("ai-chat", data);
    } catch (err) {
      console.error("[AI Chat Page Error]", err?.stack || err?.message || err);
      return sendDashboardError(req, res, "/dashboard", "Failed to load AI chat settings", err, 500);
    }
  });

  app.post("/ai-chat/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const guildId = getGuildId(req);

      const savePayload = {
        guildId,
        guildName: guild?.name || "",
        enabled: req.body.enabled === "on",
        preferredProvider: ["auto", "groq", "openrouter", "gemini", "local"].includes(req.body.preferredProvider) ? req.body.preferredProvider : "auto",
        personality: ["friendly", "funny", "helpful", "savage-lite", "formal"].includes(req.body.personality) ? req.body.personality : "friendly",
        botMode: ["auto", "chat", "helper", "moderator", "fun", "study"].includes(req.body.botMode) ? req.body.botMode : "auto",
        autoDetectMode: req.body.autoDetectMode === "on",
        customSystemPrompt: String(req.body.customSystemPrompt || "").trim().slice(0, 1500),
        replyOnlyOnMention: true,
        saveMemory: req.body.saveMemory === "on",
        memoryLimit: Math.max(0, Math.min(20, Number(req.body.memoryLimit || 6))),
        cooldownSeconds: Math.max(0, Math.min(3600, Number(req.body.cooldownSeconds || 2))),
        maxReplyChars: Math.max(50, Math.min(1900, Number(req.body.maxReplyChars || 500))),
        sessionIdleMinutes: Math.max(1, Math.min(1440, Number(req.body.sessionIdleMinutes || 5))),
        stopCommand: String(req.body.stopCommand || "$stop").trim().slice(0, 30) || "$stop",
        appendStopHint: req.body.appendStopHint === "on",
        stopHintText: String(req.body.stopHintText || "If you want to close AI chat, write $stop.").trim().slice(0, 180),
        defaultDailyLimit: Math.max(0, Math.min(10000, Number(req.body.defaultDailyLimit || 20))),
        maxSessionMessages: Math.max(1, Math.min(500, Number(req.body.maxSessionMessages || 40))),
        roleLimits: parseAiChatRoleLimits(req.body.roleLimitsJson, guild),
        unlimitedRoleIds: parseAiChatChannelList(req.body.unlimitedRoleIdsJson),
        allowedMode: ["all", "allowed", "ignored"].includes(req.body.allowedMode) ? req.body.allowedMode : "all",
        allowedChannelIds: parseAiChatChannelList(req.body.allowedChannelIdsJson),
        ignoredChannelIds: parseAiChatChannelList(req.body.ignoredChannelIdsJson),
        mentionReplyMode: "reply",
        updatedBy: req.session?.userId || req.session?.discordUser?.id || "dashboard",
      };

      if (!savePayload.customSystemPrompt) {
        savePayload.customSystemPrompt = "You are Legendary Bot, a friendly Discord bot. Be helpful, fun, short, and safe. Keep replies suitable for a Discord community.";
      }

      await AiMentionChatConfig.findOneAndUpdate(
        { guildId },
        { $set: savePayload },
        { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );

      return sendDashboardSuccess(req, res, getScopedPath(req, "/ai-chat"), "AI chat settings saved", { redirect: null });
    } catch (err) {
      console.error("[AI Chat Save Error]", err?.stack || err?.message || err);
      return sendDashboardError(req, res, getScopedPath(req, "/ai-chat"), "Failed to save AI chat settings", err, 500);
    }
  });

  app.post("/ai-chat/reset-memory", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      await aiMentionChatManager.resetMemory(guildId);
      return sendDashboardSuccess(req, res, getScopedPath(req, "/ai-chat"), "AI chat memory cleared", { redirect: null });
    } catch (err) {
      console.error("[AI Chat Memory Reset Error]", err?.stack || err?.message || err);
      return sendDashboardError(req, res, getScopedPath(req, "/ai-chat"), "Failed to clear AI chat memory", err, 500);
    }
  });

  app.get("/owner/:guildId/ai-tickets", requireAuth, async (req, res) => {
    req.session.selectedGuildId = req.params.guildId;
    req.session.loginRole = "dashboard";
    req.session.loggedIn = true;
    req.session.ownerLoggedIn = true;
    return res.redirect("/ai-tickets");
  });

  app.get("/owner/:guildId/ai-tickets/:module", requireAuth, async (req, res) => {
    req.session.selectedGuildId = req.params.guildId;
    req.session.loginRole = "dashboard";
    req.session.loggedIn = true;
    req.session.ownerLoggedIn = true;

    const moduleKey = String(req.params.module || "home").trim();
    return res.redirect(`/ai-tickets?module=${encodeURIComponent(moduleKey)}`);
  });


  app.get("/ai-tickets/:module", requireAuth, requireSelectedGuild, async (req, res) => {
    const moduleKey = String(req.params.module || "staff_application").trim();
    return res.redirect(`/ai-tickets?module=${encodeURIComponent(moduleKey)}`);
  });

  app.get("/ai-tickets", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const guild = getSelectedGuild(req);

      const config = await getOrCreateAITicketDashboardConfig(guildId, guild);

      const data = await buildViewData(req, "ai-tickets", {
        config,
        channelGroups: await getChannelGroups(req),
        categories: await getGuildCategories(req),
        allChannelGroups: await getAllGuildSelectableChannels(req),
        roles: await getGuildRoles(req),
        selectedModule: req.query.module || "home",
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("ai-tickets", data);
    } catch (err) {
      console.error("[AI Tickets Page Error]", err?.stack || err?.message || err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to load AI ticket settings", err);
    }
  });

    async function saveAITicketSettingsHandler(req, res) {
    try {
      const guildId = getGuildId(req);
      const guild = getSelectedGuild(req);

      const existingConfig = await modelFindOneSafe(AITicketConfig, { guildId });
      const finalScoreMax = Math.max(10, Math.min(1000, Number(req.body.finalScoreMax || existingConfig?.finalScoreMax || 100)));
      const passScore = Math.max(1, Math.min(finalScoreMax, Number(req.body.passScore || existingConfig?.passScore || 100)));
      const staffReviewMinScore = Math.max(0, Math.min(passScore, Number(req.body.staffReviewMinScore || existingConfig?.staffReviewMinScore || 75)));

      const savePayload = {
        guildId,
        guildName: guild?.name || existingConfig?.guildName || "",
        enabled: req.body.enabled === "on",
        aiEnabled: req.body.aiEnabled === "on",
        strictness: ["relaxed", "normal", "strict"].includes(req.body.strictness) ? req.body.strictness : "normal",
        preferredProvider: ["auto", "groq", "openrouter", "gemini", "local"].includes(req.body.preferredProvider) ? req.body.preferredProvider : "auto",

        finalScoreMax,
        passScore,
        staffReviewMinScore,
        pendingPingMinutes: Math.max(5, Math.min(1440, Number(req.body.pendingPingMinutes || existingConfig?.pendingPingMinutes || 30))),
        sessionTimeoutMinutes: Math.max(15, Math.min(1440, Number(req.body.sessionTimeoutMinutes || existingConfig?.sessionTimeoutMinutes || 60))),

        requireNextCommand: req.body.requireNextCommand === "on",
        nextCommand: String(req.body.nextCommand || existingConfig?.nextCommand || "$next").trim().slice(0, 30) || "$next",

        autoApproveEnabled: req.body.autoApproveEnabled === "on",
        autoApproveRoleId: String(req.body.autoApproveRoleId || "").replace(/\D/g, "").slice(0, 30),
        autoApproveOnlyIfNoAiFlags: req.body.autoApproveOnlyIfNoAiFlags === "on",

        reportWebhookUrl: String(req.body.reportWebhookUrl || "").trim().slice(0, 500),
        saveRawAnswersAfterReport: req.body.saveRawAnswersAfterReport === "on",

        aiCopyDetectionEnabled: req.body.aiCopyDetectionEnabled === "on",
        aiCopyMinChars: Math.max(100, Math.min(3000, Number(req.body.aiCopyMinChars || existingConfig?.aiCopyMinChars || 350))),
        aiCopyFastSeconds: Math.max(5, Math.min(300, Number(req.body.aiCopyFastSeconds || existingConfig?.aiCopyFastSeconds || 45))),
        aiCopyScoreCap: Math.max(1, Math.min(10, Number(req.body.aiCopyScoreCap || existingConfig?.aiCopyScoreCap || 7))),

        types: buildAITicketTypesFromBody(req.body, existingConfig?.types || []),
        updatedBy: req.session?.userId || "dashboard",
        updatedAt: new Date(),
      };

      const savedConfig = await AITicketConfig.findOneAndUpdate(
        { guildId },
        { $set: savePayload },
        { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );

      if (!savedConfig) {
        throw new Error("MongoDB did not return the saved AI ticket config.");
      }

      const returnPath = getScopedPath(req, "/ai-tickets/staff_application");
      return sendDashboardSuccess(req, res, returnPath, "AI ticket settings saved", { redirect: null });
    } catch (err) {
      console.error("[AI Tickets Save Error]", err?.stack || err?.message || err);
      const returnPath = getScopedPath(req, "/ai-tickets/staff_application");
      return sendDashboardError(req, res, returnPath, "Failed to save AI ticket settings", err, 500);
    }
   }

  app.post("/ai-tickets/save", requireAuth, requireSelectedGuild, saveAITicketSettingsHandler);

  app.post("/owner/:guildId/ai-tickets/save", requireOwnerAuth, async (req, res) => {
    const guildId = String(req.params.guildId || "");
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return sendDashboardError(req, res, "/owner/servers", "Server not found or bot is not installed there", null, 404);
    }

    req.session.selectedGuildId = guildId;
    req.session.loginRole = "dashboard";
    req.session.loggedIn = true;
    req.session.ownerLoggedIn = true;
    req.session.scopedRouteBase = `/owner/${guildId}`;

    return saveAITicketSettingsHandler(req, res);
  });



  function isCommandCenterTextChannel(channel) {
    return Boolean(
      channel &&
      channel.guild &&
      (
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement ||
        channel.type === ChannelType.GuildForum ||
        channel.type === 0 ||
        channel.type === 5 ||
        channel.type === 15
      )
    );
  }

  function serializeCommandCenterMessage(message) {
    const author = message.author || {};
    return {
      id: message.id,
      channelId: message.channelId,
      guildId: message.guildId,
      content: message.content || "",
      cleanContent: message.cleanContent || message.content || "",
      createdTimestamp: message.createdTimestamp || Date.now(),
      editedTimestamp: message.editedTimestamp || null,
      pinned: Boolean(message.pinned),
      system: Boolean(message.system),
      author: {
        id: author.id || "",
        username: author.username || "Unknown",
        tag: author.tag || author.username || "Unknown",
        bot: Boolean(author.bot),
        avatar: author.displayAvatarURL ? author.displayAvatarURL({ extension: "png", size: 64, forceStatic: false }) : "",
      },
      attachments: [...(message.attachments?.values?.() || [])].map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        url: attachment.url,
        contentType: attachment.contentType || "",
        size: attachment.size || 0,
      })),
      embeds: (message.embeds || []).map((embed) => ({
        title: embed.title || "",
        description: embed.description || "",
        url: embed.url || "",
        color: embed.color || null,
      })),
    };
  }

  function serializeCommandCenterChannel(channel) {
    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId || "no-category",
      position: channel.rawPosition ?? channel.position ?? 0,
      topic: channel.topic || "",
      nsfw: Boolean(channel.nsfw),
    };
  }

  async function logCommandCenterAction(req, payload = {}) {
    try {
      await CommandCenterLog.create({
        guildId: payload.guildId || getGuildId(req),
        guildName: payload.guildName || getGuildName(req),
        channelId: payload.channelId || "",
        channelName: payload.channelName || "",
        action: payload.action || "unknown",
        actorId: req.session?.userId || req.session?.discordUser?.id || "owner-dashboard",
        actorName: req.session?.username || req.session?.discordUser?.username || "Owner Dashboard",
        targetId: payload.targetId || "",
        targetName: payload.targetName || "",
        messageId: payload.messageId || "",
        status: payload.status || "success",
        reason: payload.reason || "",
        metadata: payload.metadata || {},
      });
    } catch (err) {
      console.error("[Command Center Log Error]", err?.message || err);
    }
  }

  async function buildCommandCenterChannelGroups(guild) {
    if (!guild) return [];

    await guild.channels.fetch().catch(() => null);

    const allChannels = [...guild.channels.cache.values()];

    const categories = allChannels
      .filter((channel) => channel.type === ChannelType.GuildCategory || channel.type === 4 || channel.type === "GuildCategory")
      .map((category) => ({
        id: category.id,
        name: category.name,
        position: category.rawPosition ?? category.position ?? 0,
        channels: [],
      }))
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

    const categoryMap = new Map(categories.map((category) => [category.id, category]));

    const uncategorized = {
      id: "no-category",
      name: "No Category",
      position: 999999,
      channels: [],
    };

    allChannels
      .filter((channel) =>
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement ||
        channel.type === ChannelType.GuildForum ||
        channel.type === 0 ||
        channel.type === 5 ||
        channel.type === 15
      )
      .map(serializeCommandCenterChannel)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
      .forEach((channel) => {
        const parent = categoryMap.get(channel.parentId) || uncategorized;
        parent.channels.push(channel);
      });

    const groups = [...categories];
    if (uncategorized.channels.length) groups.push(uncategorized);

    return groups;
  }

  app.get("/owner/:guildId/command-center", requireOwnerAuth, async (req, res) => {
    try {
      const guildId = String(req.params.guildId || "");
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return sendDashboardError(req, res, "/owner/servers", "Server not found or bot is not installed there", null, 404);
      }

      req.session.selectedGuildId = guildId;
      req.session.loginRole = "dashboard";
      req.session.loggedIn = true;
      req.session.ownerLoggedIn = true;
      req.session.scopedRouteBase = `/owner/${guildId}`;

      const data = await buildViewData(req, "owner-command-center", {
        selectedModule: "command-center",
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("command-center", data);
    } catch (err) {
      console.error("[Command Center Page Error]", err?.stack || err?.message || err);
      return sendDashboardError(req, res, "/dashboard", "Failed to load Legendary Command Center", err, 500);
    }
  });

  app.get("/command-center", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      req.session.loginRole = "dashboard";
      req.session.loggedIn = true;
      req.session.ownerLoggedIn = true;

      const guildId = getGuildId(req);
      if (guildId && guildId !== "unknown") {
        req.session.scopedRouteBase = `/owner/${guildId}`;
      }

      const data = await buildViewData(req, "owner-command-center", {
        selectedModule: "command-center",
        success: req.query.success || null,
        error: req.query.error || null,
      });

      return res.render("command-center", data);
    } catch (err) {
      console.error("[Command Center Render Error]", err?.stack || err?.message || err);
      return sendDashboardError(req, res, "/dashboard", "Failed to load Legendary Command Center", err, 500);
    }
  });

  app.get("/api/command-center/bootstrap", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      if (!guild) return res.status(404).json({ ok: false, message: "No selected server" });

      const channelGroups = await buildCommandCenterChannelGroups(guild);

      return res.json({
        ok: true,
        guild: {
          id: guild.id,
          name: guild.name,
          icon: guild.iconURL({ extension: "png", size: 128, forceStatic: false }) || getBotAvatar(),
          memberCount: guild.memberCount || 0,
        },
        bot: {
          id: client.user?.id || "",
          username: client.user?.username || "Legendary Bot",
          avatar: getBotAvatar(),
        },
        channelGroups,
        roles: getCommandCenterRoles(guild),
      });
    } catch (err) {
      console.error("[Command Center Bootstrap Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to load command center data" });
    }
  });

  app.get("/api/command-center/messages", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const channelId = String(req.query.channelId || "").trim();
      const before = String(req.query.before || "").trim();
      const after = String(req.query.after || "").trim();
      const limit = Math.max(1, Math.min(50, Number(req.query.limit || 35)));

      const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;

      if (!guild || !channel || channel.guildId !== guild.id || !isCommandCenterTextChannel(channel)) {
        return res.status(400).json({ ok: false, message: "Invalid channel selected" });
      }

      const fetchOptions = { limit };
      if (before) fetchOptions.before = before;
      if (after) fetchOptions.after = after;

      const messages = await channel.messages.fetch(fetchOptions);
      const serialized = [...messages.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map(serializeCommandCenterMessage);

      return res.json({
        ok: true,
        channel: serializeCommandCenterChannel(channel),
        messages: serialized,
        hasMore: serialized.length >= limit && !after,
      });
    } catch (err) {
      console.error("[Command Center Messages Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to load messages" });
    }
  });

  app.post("/api/command-center/send-message", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const channelId = String(req.body.channelId || "").trim();
      const content = String(req.body.content || "").trim().slice(0, 1900);
      const replyToMessageId = String(req.body.replyToMessageId || "").trim();

      const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;

      if (!guild || !channel || channel.guildId !== guild.id || !isCommandCenterTextChannel(channel)) {
        return res.status(400).json({ ok: false, message: "Invalid channel selected" });
      }

      if (!content) {
        return res.status(400).json({ ok: false, message: "Message cannot be empty" });
      }

      let sent;
      if (replyToMessageId && channel.messages?.fetch) {
        const target = await channel.messages.fetch(replyToMessageId).catch(() => null);
        if (target) {
          sent = await target.reply({ content, allowedMentions: { parse: ["users", "roles"], repliedUser: false } });
        }
      }

      if (!sent) {
        sent = await channel.send({ content, allowedMentions: { parse: ["users", "roles"] } });
      }

      await logCommandCenterAction(req, {
        guildId: guild.id,
        guildName: guild.name,
        channelId: channel.id,
        channelName: channel.name,
        action: "send_message",
        messageId: sent.id,
        status: "success",
        metadata: { length: content.length, replied: Boolean(replyToMessageId) },
      });

      return res.json({
        ok: true,
        message: "Message sent",
        sent: serializeCommandCenterMessage(sent),
      });
    } catch (err) {
      console.error("[Command Center Send Error]", err?.stack || err?.message || err);
      await logCommandCenterAction(req, {
        action: "send_message",
        status: "error",
        reason: err?.message || "Send failed",
      });
      return res.status(500).json({ ok: false, message: err?.message || "Failed to send message" });
    }
  });

  app.post("/api/command-center/delete-message", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const channelId = String(req.body.channelId || "").trim();
      const messageId = String(req.body.messageId || "").trim();
      const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;

      if (!guild || !channel || channel.guildId !== guild.id || !isCommandCenterTextChannel(channel) || !messageId) {
        return res.status(400).json({ ok: false, message: "Invalid channel/message selected" });
      }

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) return res.status(404).json({ ok: false, message: "Message not found" });

      await message.delete();

      await logCommandCenterAction(req, {
        guildId: guild.id,
        guildName: guild.name,
        channelId: channel.id,
        channelName: channel.name,
        action: "delete_message",
        messageId,
        status: "success",
      });

      return res.json({ ok: true, message: "Message deleted", messageId });
    } catch (err) {
      console.error("[Command Center Delete Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to delete message" });
    }
  });


  async function getCommandCenterMember(guild, memberId) {
    if (!guild || !memberId) return null;
    return guild.members.fetch(memberId).catch(() => null);
  }

  function serializeCommandCenterMember(member) {
    if (!member) return null;
    const user = member.user || {};
    const roles = member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.hexColor || "#99aab5",
        position: role.position,
      }));

    const topRole = roles[0] || {
      id: "",
      name: user.bot ? "Bots" : "Members",
      color: user.bot ? "#5865f2" : "#99aab5",
      position: user.bot ? 999998 : 0,
    };

    return {
      id: member.id,
      username: user.username || "Unknown",
      tag: user.tag || user.username || "Unknown",
      displayName: member.displayName || user.username || "Unknown",
      avatar: user.displayAvatarURL ? user.displayAvatarURL({ extension: "png", size: 64, forceStatic: false }) : "",
      bot: Boolean(user.bot),
      joinedTimestamp: member.joinedTimestamp || null,
      topRole,
      color: member.displayHexColor && member.displayHexColor !== "#000000" ? member.displayHexColor : topRole.color,
      roles,
    };
  }

  function getCommandCenterRoles(guild) {
    return guild.roles.cache
      .filter((role) => role.id !== guild.id && !role.managed)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.hexColor || "#99aab5",
        position: role.position,
      }));
  }

  app.get("/api/command-center/members", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const q = String(req.query.q || "").trim().toLowerCase();

      if (!guild) return res.status(404).json({ ok: false, message: "No selected server" });

      await guild.members.fetch().catch(() => null);

      const members = guild.members.cache
        .filter((member) => {
          if (!q) return true;
          return (
            member.id.includes(q) ||
            member.user.username.toLowerCase().includes(q) ||
            member.displayName.toLowerCase().includes(q) ||
            (member.user.tag || "").toLowerCase().includes(q)
          );
        })
        .sort((a, b) => {
          const aRole = a.roles.highest?.position || 0;
          const bRole = b.roles.highest?.position || 0;
          if (bRole !== aRole) return bRole - aRole;
          return (a.displayName || a.user.username).localeCompare(b.displayName || b.user.username);
        })
        .map(serializeCommandCenterMember);

      const groupsMap = new Map();
      for (const member of members) {
        const topRole = member.topRole || {};
        const key = topRole.id || (member.bot ? "bots" : "members");
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            id: key,
            name: topRole.name || (member.bot ? "Bots" : "Members"),
            color: topRole.color || "#99aab5",
            position: topRole.position || 0,
            members: [],
          });
        }
        groupsMap.get(key).members.push(member);
      }

      const groups = [...groupsMap.values()].sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));

      return res.json({ ok: true, members, groups });
    } catch (err) {
      console.error("[Command Center Member Search Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to search members" });
    }
  });

  app.post("/api/command-center/dm", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const memberId = String(req.body.memberId || "").trim();
      const content = String(req.body.content || "").trim().slice(0, 1900);
      const member = await getCommandCenterMember(guild, memberId);

      if (!member) return res.status(404).json({ ok: false, message: "Member not found" });
      if (!content) return res.status(400).json({ ok: false, message: "DM message cannot be empty" });

      await member.send({ content, allowedMentions: { parse: [] } });

      await logCommandCenterAction(req, {
        guildId: guild.id,
        guildName: guild.name,
        action: "send_dm",
        targetId: member.id,
        targetName: member.user?.tag || member.displayName,
        status: "success",
      });

      return res.json({ ok: true, message: "DM sent as bot" });
    } catch (err) {
      console.error("[Command Center DM Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to DM member. Their privacy settings may block bot DMs." });
    }
  });


  app.get("/api/command-center/dm-messages", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const memberId = String(req.query.memberId || "").trim();
      const before = String(req.query.before || "").trim();
      const member = await getCommandCenterMember(guild, memberId);

      if (!member) return res.status(404).json({ ok: false, message: "Member not found" });

      const dm = await member.createDM();
      const fetchOptions = { limit: 50 };
      if (before) fetchOptions.before = before;

      const messages = await dm.messages.fetch(fetchOptions);
      const serialized = [...messages.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map(serializeCommandCenterMessage);

      return res.json({ ok: true, member: serializeCommandCenterMember(member), messages: serialized });
    } catch (err) {
      console.error("[Command Center DM Messages Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to load bot DM messages" });
    }
  });

  app.post("/api/command-center/dm-send", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const memberId = String(req.body.memberId || "").trim();
      const content = String(req.body.content || "").trim().slice(0, 1900);
      const member = await getCommandCenterMember(guild, memberId);

      if (!member) return res.status(404).json({ ok: false, message: "Member not found" });
      if (!content) return res.status(400).json({ ok: false, message: "DM message cannot be empty" });

      const sent = await member.send({ content, allowedMentions: { parse: [] } });

      await logCommandCenterAction(req, {
        guildId: guild.id,
        guildName: guild.name,
        action: "send_dm",
        targetId: member.id,
        targetName: member.user?.tag || member.displayName,
        messageId: sent.id,
        status: "success",
      });

      return res.json({ ok: true, message: "DM sent as bot", sent: serializeCommandCenterMessage(sent) });
    } catch (err) {
      console.error("[Command Center DM Send Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to DM member. Their privacy settings may block bot DMs." });
    }
  });

  app.post("/api/command-center/member-action", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const memberId = String(req.body.memberId || "").trim();
      const action = String(req.body.action || "").trim();
      const reason = String(req.body.reason || "Legendary Command Center action").slice(0, 250);
      const roleId = String(req.body.roleId || "").trim();
      const member = await getCommandCenterMember(guild, memberId);

      if (!guild || !member) return res.status(404).json({ ok: false, message: "Member not found" });

      if (action === "timeout") {
        const minutes = Math.max(1, Math.min(10080, Number(req.body.minutes || 10)));
        await member.timeout(minutes * 60 * 1000, reason);
      } else if (action === "untimeout") {
        await member.timeout(null, reason);
      } else if (action === "kick") {
        await member.kick(reason);
      } else if (action === "ban") {
        await member.ban({ reason });
      } else if (action === "addRole") {
        if (!roleId) return res.status(400).json({ ok: false, message: "Role is required" });
        await member.roles.add(roleId, reason);
      } else if (action === "removeRole") {
        if (!roleId) return res.status(400).json({ ok: false, message: "Role is required" });
        await member.roles.remove(roleId, reason);
      } else {
        return res.status(400).json({ ok: false, message: "Invalid member action" });
      }

      await logCommandCenterAction(req, {
        guildId: guild.id,
        guildName: guild.name,
        action: `member_${action}`,
        targetId: member.id,
        targetName: member.user?.tag || member.displayName,
        status: "success",
        reason,
        metadata: { roleId },
      });

      return res.json({ ok: true, message: `Action completed: ${action}` });
    } catch (err) {
      console.error("[Command Center Member Action Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to run member action" });
    }
  });


  app.post("/api/command-center/member-role", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const memberId = String(req.body.memberId || "").trim();
      const roleId = String(req.body.roleId || "").trim();
      const mode = String(req.body.mode || "add").trim();
      const member = await getCommandCenterMember(guild, memberId);

      if (!guild || !member) return res.status(404).json({ ok: false, message: "Member not found" });
      if (!roleId) return res.status(400).json({ ok: false, message: "Role is required" });

      const role = guild.roles.cache.get(roleId);
      if (!role) return res.status(404).json({ ok: false, message: "Role not found" });

      if (mode === "remove") {
        await member.roles.remove(roleId, "Legendary Command Center role remove");
      } else {
        await member.roles.add(roleId, "Legendary Command Center role add");
      }

      const freshMember = await guild.members.fetch(memberId).catch(() => member);

      await logCommandCenterAction(req, {
        guildId: guild.id,
        guildName: guild.name,
        action: mode === "remove" ? "remove_role" : "add_role",
        targetId: member.id,
        targetName: member.user?.tag || member.displayName,
        status: "success",
        metadata: { roleId, roleName: role.name },
      });

      return res.json({
        ok: true,
        message: mode === "remove" ? "Role removed" : "Role added",
        member: serializeCommandCenterMember(freshMember),
      });
    } catch (err) {
      console.error("[Command Center Member Role Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to update member role" });
    }
  });



  app.get("/api/command-center/commands", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const seen = new Set();
      const commands = [];

      for (const command of client.commands.values()) {
        const name = command?.data?.name || command?.name;
        if (!name || seen.has(name)) continue;
        seen.add(name);

        commands.push({
          name,
          usage: `/${name}`,
          description: command?.data?.description || command?.description || "Legendary Bot command",
          accessLevel: getDashboardCommandAccessLevel(command),
          prefixOnly: Boolean(command.prefixOnly),
        });
      }

      commands.sort((a, b) => a.name.localeCompare(b.name));

      return res.json({ ok: true, commands });
    } catch (err) {
      console.error("[Command Center Commands Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to load commands" });
    }
  });

  app.post("/api/command-center/slash-command", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const channelId = String(req.body.channelId || "").trim();
      const raw = String(req.body.command || "").trim().slice(0, 500);
      const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;

      if (!guild || !channel || channel.guildId !== guild.id || !isCommandCenterTextChannel(channel)) {
        return res.status(400).json({ ok: false, message: "Invalid channel selected" });
      }

      if (!raw.startsWith("/")) {
        return res.status(400).json({ ok: false, message: "Slash command must start with /" });
      }

      const [commandNameRaw, ...parts] = raw.slice(1).split(/\s+/);
      const commandName = String(commandNameRaw || "").toLowerCase();
      const args = parts.join(" ").trim();

      let output = "";

      if (commandName === "weather") {
        const place = args || "your area";
        output = `🌦️ Weather request for **${place}**\\n\\nWeather lookup is ready in the Command Center UI, but no weather API key is connected yet. Add a weather provider later and this command will post real live weather here.`;
      } else if (commandName === "say") {
        output = args || "Say command used.";
      } else if (commandName === "ping") {
        output = `🏓 Pong! Legendary Command Center is online.`;
      } else if (commandName === "help") {
        output = [
          "⚡ **Legendary Command Center Commands**",
          "`/weather <city>` - show weather placeholder",
          "`/say <message>` - send a bot message",
          "`/ping` - bot status check",
          "`/help` - show this menu",
        ].join("\\n");
      } else {
        output = `❌ Unknown Command Center command: **/${commandName}**\\nType **/** in the message box to see available commands.`;
      }

      const sent = await channel.send({
        content: output,
        allowedMentions: { parse: ["users", "roles"] },
      });

      await logCommandCenterAction(req, {
        guildId: guild.id,
        guildName: guild.name,
        channelId: channel.id,
        channelName: channel.name,
        action: "slash_command",
        messageId: sent.id,
        status: "success",
        metadata: { command: raw },
      });

      return res.json({
        ok: true,
        message: "Command posted",
        sent: serializeCommandCenterMessage(sent),
      });
    } catch (err) {
      console.error("[Command Center Slash Command Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to run command" });
    }
  });

  app.post("/api/command-center/create-category", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const name = String(req.body.name || "").trim().slice(0, 90);
      if (!guild) return res.status(404).json({ ok: false, message: "No selected server" });
      if (!name) return res.status(400).json({ ok: false, message: "Category name is required" });

      const category = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        reason: "Legendary Command Center category creation",
      });

      await logCommandCenterAction(req, {
        guildId: guild.id,
        guildName: guild.name,
        action: "create_category",
        channelId: category.id,
        channelName: category.name,
        status: "success",
      });

      return res.json({ ok: true, message: "Category created", category: serializeCommandCenterChannel(category) });
    } catch (err) {
      console.error("[Command Center Create Category Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to create category" });
    }
  });

  app.post("/api/command-center/create-channel", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const name = String(req.body.name || "").trim().slice(0, 90);
      const parentId = String(req.body.parentId || "").trim();
      const channelType = String(req.body.type || "text");
      if (!guild) return res.status(404).json({ ok: false, message: "No selected server" });
      if (!name) return res.status(400).json({ ok: false, message: "Channel name is required" });

      const created = await guild.channels.create({
        name,
        type: channelType === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: parentId || undefined,
        reason: "Legendary Command Center channel creation",
      });

      await logCommandCenterAction(req, {
        guildId: guild.id,
        guildName: guild.name,
        action: `create_${channelType}_channel`,
        channelId: created.id,
        channelName: created.name,
        status: "success",
      });

      return res.json({ ok: true, message: "Channel created", channel: serializeCommandCenterChannel(created) });
    } catch (err) {
      console.error("[Command Center Create Channel Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to create channel" });
    }
  });

  app.post("/api/command-center/create-role", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guild = getSelectedGuild(req);
      const name = String(req.body.name || "").trim().slice(0, 90);
      const color = String(req.body.color || "#8b5cf6").trim();
      if (!guild) return res.status(404).json({ ok: false, message: "No selected server" });
      if (!name) return res.status(400).json({ ok: false, message: "Role name is required" });

      const role = await guild.roles.create({
        name,
        color,
        reason: "Legendary Command Center role creation",
      });

      await logCommandCenterAction(req, {
        guildId: guild.id,
        guildName: guild.name,
        action: "create_role",
        targetId: role.id,
        targetName: role.name,
        status: "success",
      });

      return res.json({ ok: true, message: "Role created", role: { id: role.id, name: role.name, color: role.hexColor || "#99aab5" } });
    } catch (err) {
      console.error("[Command Center Create Role Error]", err?.stack || err?.message || err);
      return res.status(500).json({ ok: false, message: err?.message || "Failed to create role" });
    }
  });

  app.get("/api/command-center/voice-status", requireOwnerAuth, requireSelectedGuild, async (req, res) => {
    return res.json({
      ok: true,
      ready: false,
      message: "Voice/music controls are planned for a dedicated music engine. This safe placeholder will not crash the dashboard.",
    });
  });

  app.get("/predictions", requireAuth, requireSelectedGuild, async (req, res) => {
    const data = await buildViewData(req, "predictions", {
      success: req.query.success || null,
      error: req.query.error || null,
    });
    return res.render("predictions", data);
  });

  app.get("/polls", requireAuth, requireSelectedGuild, async (req, res) => {
    const data = await buildViewData(req, "polls", {
      channelGroups: await getChannelGroups(req),
      success: req.query.success || null,
      error: req.query.error || null,
    });
    return res.render("polls", data);
  });

  app.post("/polls/send", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const { channelId, question, option1, option2, option3, option4, option5, color } = req.body;
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.guildId !== guildId) return dashboardJsonOrRedirect(req, res, "/polls", { ok: false, message: "Invalid poll channel selected" });
      const options = [option1, option2, option3, option4, option5].map((x) => String(x || "").trim()).filter(Boolean);
      if (!question?.trim()) return dashboardJsonOrRedirect(req, res, "/polls", { ok: false, message: "Poll question is required" });
      if (options.length < 2) return dashboardJsonOrRedirect(req, res, "/polls", { ok: false, message: "Add at least two poll options" });
      const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
      const embed = new EmbedBuilder()
        .setTitle("📊 Poll")
        .setDescription(`**${question.trim()}**\n\n${options.map((opt, i) => `${emojis[i]} ${opt}`).join("\n")}`)
        .setColor(cleanDashboardHex(color, "#8b5cf6"))
        .setFooter({ text: "Vote by reacting below." })
        .setTimestamp();
      const sent = await channel.send({ embeds: [embed] });
      for (let i = 0; i < options.length; i++) await sent.react(emojis[i]).catch(() => null);
      return dashboardJsonOrRedirect(req, res, "/polls", { ok: true, message: "Poll sent successfully" });
    } catch (err) {
      console.error("[Dashboard Poll Send Error]", err);
      return redirectWithDashboardError(res, "/polls", "Failed to send poll", err);
    }
  });

  app.get("/search-anything", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const query = String(req.query.q || "").trim();
      const results = [];
      if (query) {
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const templates = await modelFindSafe(DashboardEmbedTemplate, { guildId, $or: [{ name: regex }, { category: regex }, { embedTitle: regex }, { embedDescription: regex }, { content: regex }] }).limit(10);
        templates.forEach((x) => results.push({ type: "Embed Template", title: x.name, detail: x.category || x.sourceLabel || "Template" }));
        const autos = await modelFindSafe(DashboardAutoMessage, { guildId, $or: [{ name: regex }, { content: regex }, { embedTitle: regex }, { embedDescription: regex }] }).limit(10);
        autos.forEach((x) => results.push({ type: "Auto Message", title: x.name, detail: `#${x.channelName || "unknown"}` }));
        const confessions = await Confession.find({ guildId, text: regex }).sort({ createdAt: -1 }).limit(10);
        confessions.forEach((x) => results.push({ type: "Confession", title: `#${x.confessionNumber || x.messageId}`, detail: x.text.slice(0, 120) }));
        const levels = await DashboardLevelUser.find({ guildId, $or: [{ username: regex }, { userId: regex }] }).sort({ xp: -1 }).limit(10);
        levels.forEach((x) => results.push({ type: "Level User", title: x.username || x.userId, detail: `Level ${x.level || 0} • ${x.xp || 0} XP` }));
        const cmds = await modelFindSafe(DashboardCustomCommand, { guildId, $or: [{ trigger: regex }, { response: regex }] }).limit(10);
        cmds.forEach((x) => results.push({ type: "Custom Command", title: `$${x.trigger}`, detail: x.response?.slice(0, 120) || x.embedTitle || "Command" }));
      }
      const data = await buildViewData(req, "search-anything", { query, results, success: null, error: req.query.error || null });
      return res.render("search-anything", data);
    } catch (err) {
      console.error("[Dashboard Search Anything Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to search", err);
    }
  });




  // =========================================================
  // MEGA FOUNDATION ROUTES — AI V2, Giveaways, Analytics, Workflows
  // Safe dashboard foundations only. Real Discord actions connect in later phases.
  // =========================================================

  function getDashboardGiveawaysPath(req) {
    const guildId = getGuildId(req);
    if (req.session?.loginRole === "customer" && guildId) {
      return `${customerServerPath(req, guildId, "dashboard/giveaways")}`;
    }
    if (guildId) return `/owner/${guildId}/dashboard/giveaways`;
    return "/dashboard/giveaways";
  }

  function formatDashboardGiveawayTime(date) {
    if (!date) return "Unknown";
    try {
      return new Date(date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return String(date);
    }
  }

  async function buildGiveawayDashboardData(req) {
    const guild = getSelectedGuild(req);
    const guildId = getGuildId(req);

    const giveawayConfig =
      (await modelFindOneSafe(DashboardGiveawayConfig, { guildId }).catch(() => null)) ||
      new DashboardGiveawayConfig({ guildId });

    const runs = await modelFindSafe(
      DashboardGiveawayRun,
      { guildId },
      null,
      { sort: { createdAt: -1 }, limit: 50 }
    ).catch(() => []);

    const activeGiveaways = (runs || []).filter((run) => run.status === "running");
    const endedGiveaways = (runs || []).filter((run) => run.status !== "running");

    const totalEntries = (runs || []).reduce((sum, run) => sum + (run.entries?.length || 0), 0);

    return {
      guild,
      guildId,
      giveawayConfig,
      activeGiveaways,
      endedGiveaways,
      giveawayStats: {
        active: activeGiveaways.length,
        ended: endedGiveaways.length,
        total: (runs || []).length,
        entries: totalEntries,
      },
      channelGroups: await getChannelGroups(req),
      formatGiveawayTime: formatDashboardGiveawayTime,
    };
  }

  app.get("/giveaways", requireAuth, requireSelectedGuild, (req, res) => {
    return res.redirect(getDashboardGiveawaysPath(req));
  });

  app.get("/dashboard/giveaways", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const giveawayData = await buildGiveawayDashboardData(req);
      const data = await buildViewData(req, "giveaways", {
        ...giveawayData,
        success: req.query.success || null,
        error: req.query.error || null,
      });
      return res.render("giveaways", data);
    } catch (err) {
      console.error("[Dashboard Giveaways Page Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to open Giveaways dashboard", err);
    }
  });

  app.post("/dashboard/giveaways/settings", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      await DashboardGiveawayConfig.findOneAndUpdate(
        { guildId },
        {
          $set: {
            enabled: req.body.enabled === "on",
            notes: String(req.body.notes || "").slice(0, 2500),
            logChannelId: String(req.body.logChannelId || ""),
            defaultDurationMinutes: Math.max(1, Math.min(525600, Number(req.body.defaultDurationMinutes || 1440))),
            defaultWinners: Math.max(1, Math.min(25, Number(req.body.defaultWinners || 1))),
            dmWinners: req.body.dmWinners === "on",
            updatedBy: req.session?.username || req.session?.discordUser?.username || "dashboard",
          },
        },
        { upsert: true, new: true }
      );
      return dashboardJsonOrRedirect(req, res, getDashboardGiveawaysPath(req), { ok: true, message: "Giveaway settings saved" });
    } catch (err) {
      console.error("[Dashboard Giveaways Settings Save Error]", err);
      return redirectWithDashboardError(res, getDashboardGiveawaysPath(req), "Failed to save giveaway settings", err);
    }
  });

  app.post("/dashboard/giveaways/create", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const guild = getSelectedGuild(req);
      const prize = String(req.body.prize || "").trim().slice(0, 180);
      const channelId = String(req.body.channelId || "").trim();
      const durationMinutes = Math.max(1, Math.min(525600, Number(req.body.durationMinutes || 1440)));
      const winnersCount = Math.max(1, Math.min(25, Number(req.body.winnersCount || 1)));
      const description = String(req.body.description || "Click Join to enter!").trim().slice(0, 1200);

      if (!prize) {
        return dashboardJsonOrRedirect(req, res, getDashboardGiveawaysPath(req), { ok: false, message: "Prize is required" });
      }

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || channel.guildId !== guildId || !channel.isTextBased()) {
        return dashboardJsonOrRedirect(req, res, getDashboardGiveawaysPath(req), { ok: false, message: "Please choose a valid giveaway text channel" });
      }

      const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);
      const run = await DashboardGiveawayRun.create({
        guildId,
        channelId,
        hostId: req.session?.discordUser?.id || req.session?.userId || "dashboard",
        hostTag: req.session?.discordUser?.username || req.session?.username || "Dashboard",
        prize,
        description,
        winnersCount,
        endsAt,
        status: "running",
      });

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${prize}`)
        .setDescription(`${description}\n\n**Winners:** ${winnersCount}\n**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`)
        .setColor(0xec4899)
        .setFooter({ text: `Giveaway ID: ${run._id}` })
        .setTimestamp(endsAt);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`dash_ga_join_${run._id}`)
          .setLabel("Join Giveaway")
          .setEmoji("🎉")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`dash_ga_entries_${run._id}`)
          .setLabel("Entries")
          .setStyle(ButtonStyle.Secondary)
      );

      const message = await channel.send({ embeds: [embed], components: [row] }).catch((err) => {
        console.error("[Dashboard Giveaway Send Error]", err);
        return null;
      });

      if (message) {
        run.messageId = message.id;
        await run.save().catch(() => null);
      }

      return dashboardJsonOrRedirect(req, res, getDashboardGiveawaysPath(req), { ok: true, message: message ? "Giveaway created and posted" : "Giveaway saved, but message could not be posted" });
    } catch (err) {
      console.error("[Dashboard Giveaways Create Error]", err);
      return redirectWithDashboardError(res, getDashboardGiveawaysPath(req), "Failed to create giveaway", err);
    }
  });

  app.post("/dashboard/giveaways/:id/end", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const run = await modelFindOneSafe(DashboardGiveawayRun, { _id: req.params.id, guildId }).catch(() => null);
      if (!run) return dashboardJsonOrRedirect(req, res, getDashboardGiveawaysPath(req), { ok: false, message: "Giveaway not found" });
      run.status = "ended";
      run.endedAt = new Date();
      await run.save();
      return dashboardJsonOrRedirect(req, res, getDashboardGiveawaysPath(req), { ok: true, message: "Giveaway marked as ended" });
    } catch (err) {
      console.error("[Dashboard Giveaways End Error]", err);
      return redirectWithDashboardError(res, getDashboardGiveawaysPath(req), "Failed to end giveaway", err);
    }
  });

  app.post("/dashboard/giveaways/:id/delete", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      await DashboardGiveawayRun.deleteOne({ _id: req.params.id, guildId });
      return dashboardJsonOrRedirect(req, res, getDashboardGiveawaysPath(req), { ok: true, message: "Giveaway deleted from dashboard database" });
    } catch (err) {
      console.error("[Dashboard Giveaways Delete Error]", err);
      return redirectWithDashboardError(res, getDashboardGiveawaysPath(req), "Failed to delete giveaway", err);
    }
  });

  app.post("/dashboard/giveaways/save", requireAuth, requireSelectedGuild, async (req, res) => {
    return res.redirect(307, "/dashboard/giveaways/settings");
  });

  app.get("/analytics", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const analyticsConfig =
        (await modelFindOneSafe(DashboardAnalyticsConfig, { guildId })) ||
        new DashboardAnalyticsConfig({ guildId });
      const analyticsStats = { commands: 0, moderation: 0, giveaways: 0 };
      const data = await buildViewData(req, "analytics", {
        analyticsConfig,
        analyticsStats,
        success: req.query.success || null,
        error: req.query.error || null,
      });
      return res.render("analytics", data);
    } catch (err) {
      console.error("[Dashboard Analytics Page Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to open Analytics", err);
    }
  });

  app.post("/analytics/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      await DashboardAnalyticsConfig.findOneAndUpdate(
        { guildId },
        { $set: { enabled: req.body.enabled === "on", notes: String(req.body.notes || "").slice(0, 2500), updatedBy: req.session?.username || "dashboard" } },
        { upsert: true, new: true }
      );
      return dashboardJsonOrRedirect(req, res, "/analytics", { ok: true, message: "Analytics foundation saved" });
    } catch (err) {
      console.error("[Dashboard Analytics Save Error]", err);
      return redirectWithDashboardError(res, "/analytics", "Failed to save Analytics", err);
    }
  });

  app.get("/workflow-automations", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const workflowConfig =
        (await modelFindOneSafe(DashboardWorkflowConfig, { guildId })) ||
        new DashboardWorkflowConfig({ guildId });
      const data = await buildViewData(req, "workflow-automations", {
        workflowConfig,
        success: req.query.success || null,
        error: req.query.error || null,
      });
      return res.render("workflow-automations", data);
    } catch (err) {
      console.error("[Dashboard Workflow Page Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to open Workflow Automations", err);
    }
  });

  app.post("/workflow-automations/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      await DashboardWorkflowConfig.findOneAndUpdate(
        { guildId },
        { $set: { enabled: req.body.enabled === "on", notes: String(req.body.notes || "").slice(0, 2500), updatedBy: req.session?.username || "dashboard" } },
        { upsert: true, new: true }
      );
      return dashboardJsonOrRedirect(req, res, "/workflow-automations", { ok: true, message: "Workflow automation foundation saved" });
    } catch (err) {
      console.error("[Dashboard Workflow Save Error]", err);
      return redirectWithDashboardError(res, "/workflow-automations", "Failed to save Workflow Automations", err);
    }
  });

  app.get("/ai-system-v2", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const aiV2Config =
        (await modelFindOneSafe(DashboardAiV2Config, { guildId })) ||
        new DashboardAiV2Config({ guildId });
      const data = await buildViewData(req, "ai-system-v2", {
        aiV2Config,
        success: req.query.success || null,
        error: req.query.error || null,
      });
      return res.render("ai-system-v2", data);
    } catch (err) {
      console.error("[Dashboard AI V2 Page Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to open AI System V2", err);
    }
  });

  app.post("/ai-system-v2/save", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      await DashboardAiV2Config.findOneAndUpdate(
        { guildId },
        { $set: { enabled: req.body.enabled === "on", notes: String(req.body.notes || "").slice(0, 2500), updatedBy: req.session?.username || "dashboard" } },
        { upsert: true, new: true }
      );
      return dashboardJsonOrRedirect(req, res, "/ai-system-v2", { ok: true, message: "AI System V2 foundation saved" });
    } catch (err) {
      console.error("[Dashboard AI V2 Save Error]", err);
      return redirectWithDashboardError(res, "/ai-system-v2", "Failed to save AI System V2", err);
    }
  });

  app.get("/db-status", requireOwnerAuth, (req, res) => {
    return res.status(200).json({
      ok: true,
      databases: getDbStatus(),
      timestamp: new Date().toISOString(),
    });
  });


  function getEventCenterPath(req) {
    return "/dashboard/events";
  }

  function cleanDashboardText(value, max = 1200) {
    return String(value || "").trim().slice(0, max);
  }

  function getPingTextFromEvent(event) {
    if (!event || event.pingMode === "none") return "";
    if (event.pingMode === "everyone") return "@everyone";
    if (event.pingMode === "here") return "@here";
    if (event.pingMode === "role" && event.roleId) return `<@&${event.roleId}>`;
    return "";
  }

  function buildEventAnnouncementText(event, stage = "created") {
    const title = cleanDashboardText(event.title, 140) || "Server Event";
    const description = cleanDashboardText(event.description, 900);
    const custom = cleanDashboardText(event.customMessage, 1400);
    const startUnix = event.startsAt ? Math.floor(new Date(event.startsAt).getTime() / 1000) : null;
    const timeLine = startUnix ? `\n\n🗓️ **When:** <t:${startUnix}:F> • <t:${startUnix}:R>` : "";
    const ping = getPingTextFromEvent(event);

    if (event.messageMode === "custom" && custom) {
      return `${ping ? `${ping}\n` : ""}${custom}${timeLine}`;
    }

    if (event.messageMode === "improve" && custom) {
      return `${ping ? `${ping}\n` : ""}✨ **${title}**\n\n${custom}\n\nGet ready, legends — this event is going to be special.${timeLine}`;
    }

    const stageText =
      stage === "reminder"
        ? "⏰ **Event Reminder**"
        : stage === "start"
          ? "🚀 **Event Starting Now**"
          : stage === "end"
            ? "✅ **Event Ended**"
            : "📢 **New Event Announcement**";

    return `${ping ? `${ping}\n` : ""}${stageText}\n\n# ${title}\n${description || "A new server event has been scheduled."}${timeLine}\n\nStay ready and join in when it starts!`;
  }

  function buildBirthdayAnnouncementText(birthday) {
    const mention = birthday.userId ? `<@${birthday.userId}>` : birthday.displayName;
    const custom = cleanDashboardText(birthday.customMessage, 1200);
    if (custom) return custom.replaceAll("{user}", mention).replaceAll("{name}", birthday.displayName);
    return `🎂 **Happy Birthday, ${mention}!**\n\nWishing you an amazing day filled with happiness, good vibes, and legendary moments. Everyone, drop your wishes! 🎉`;
  }

  function buildBirthdayDmText(birthday) {
    const name = birthday.displayName || "legend";
    const custom = cleanDashboardText(birthday.customMessage, 1200);
    if (custom) return custom.replaceAll("{user}", name).replaceAll("{name}", name);
    return `🎉 Happy Birthday, **${name}**!

Your server remembered your special day. Hope your day is full of happiness, fun, and legendary moments! 🎂`;
  }

  async function sendBirthdayDm(userId, content) {
    if (!userId || !content) return { ok: false, error: "Missing user ID or DM message" };
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return { ok: false, error: "Birthday user not found" };
    await user.send({ content });
    return { ok: true };
  }

  async function sendEventCenterMessage(guildId, channelId, content, imageUrl = "") {
    if (!guildId || !channelId || !content) return { ok: false, error: "Missing channel or message" };
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.guildId !== guildId || !channel.isTextBased()) {
      return { ok: false, error: "Invalid or inaccessible event channel" };
    }

    const embed = new EmbedBuilder()
      .setColor(0x22d3ee)
      .setDescription(content)
      .setTimestamp();

    if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
      embed.setImage(imageUrl);
    }

    await channel.send({ embeds: [embed] });
    return { ok: true };
  }

  function getNextRepeatDate(date, repeat) {
    const next = new Date(date);
    if (repeat === "daily") next.setDate(next.getDate() + 1);
    else if (repeat === "weekly") next.setDate(next.getDate() + 7);
    else if (repeat === "monthly") next.setMonth(next.getMonth() + 1);
    else if (repeat === "yearly") next.setFullYear(next.getFullYear() + 1);
    else return null;
    return next;
  }

  async function logEventCenter(guildId, data = {}) {
    try {
      await DashboardEventLog.create({
        guildId,
        eventId: data.eventId || "",
        type: data.type || "info",
        title: data.title || "",
        message: cleanDashboardText(data.message, 1500),
        createdBy: data.createdBy || "system",
      });
    } catch (err) {
      console.error("[Event Center Log Error]", err.message || String(err));
    }
  }

  async function buildEventCenterData(req) {
    const guildId = getGuildId(req);
    const config = await DashboardEventCenterConfig.findOneAndUpdate(
      { guildId },
      { $setOnInsert: { guildId } },
      { upsert: true, new: true }
    );

    const now = new Date();
    const events = await DashboardEventItem.find({
      guildId,
      status: { $ne: "cancelled" },
      startsAt: { $gte: new Date(now.getTime() - 1000 * 60 * 60) },
    })
      .sort({ startsAt: 1 })
      .limit(30)
      .lean();

    const birthdays = await DashboardBirthday.find({ guildId }).sort({ month: 1, day: 1, displayName: 1 }).lean();
    const logs = await DashboardEventLog.find({ guildId }).sort({ createdAt: -1 }).limit(20).lean();
    const sent = await DashboardEventLog.countDocuments({ guildId, type: { $in: ["announced", "birthday", "reminder"] } });

    return {
      config,
      events,
      birthdays,
      logs,
      stats: {
        upcoming: events.length,
        birthdays: birthdays.length,
        reminders: events.filter((event) => Number(event.reminderMinutes || 0) > 0).length,
        sent,
      },
      channelGroups: await getChannelGroups(req),
      formatDate(value) {
        if (!value) return "Not set";
        return new Date(value).toLocaleString();
      },
    };
  }

  app.get("/events", requireAuth, requireSelectedGuild, (req, res) => {
    return res.redirect(getEventCenterPath(req));
  });

  app.get("/dashboard/events", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const eventData = await buildEventCenterData(req);
      const data = await buildViewData(req, "events", {
        ...eventData,
        success: req.query.success || null,
        error: req.query.error || null,
      });
      return res.render("events", data);
    } catch (err) {
      console.error("[Event Center Page Error]", err);
      return redirectWithDashboardError(res, "/dashboard", "Failed to open Event Center", err);
    }
  });

  app.post("/dashboard/events/settings", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      await DashboardEventCenterConfig.findOneAndUpdate(
        { guildId },
        {
          $set: {
            enabled: req.body.enabled === "on",
            remindersEnabled: req.body.remindersEnabled === "on",
            birthdayAnnouncementsEnabled: req.body.birthdayAnnouncementsEnabled === "on",
            aiAnnouncementsEnabled: req.body.aiAnnouncementsEnabled === "on",
            defaultChannelId: cleanDashboardText(req.body.defaultChannelId, 40),
            birthdayChannelId: cleanDashboardText(req.body.birthdayChannelId, 40),
            timezone: cleanDashboardText(req.body.timezone, 80) || "Asia/Dubai",
            updatedBy: req.session?.username || req.session?.discordUser?.username || "dashboard",
          },
        },
        { upsert: true, new: true }
      );
      return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?success=Event settings saved`, { ok: true });
    } catch (err) {
      console.error("[Event Settings Save Error]", err);
      return redirectWithDashboardError(res, getEventCenterPath(req), "Failed to save event settings", err);
    }
  });

  app.post("/dashboard/events/create", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const config = await DashboardEventCenterConfig.findOne({ guildId });
      const title = cleanDashboardText(req.body.title, 140);
      const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
      const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;

      if (!title || !startsAt || Number.isNaN(startsAt.getTime())) {
        return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?error=Event title and valid start date are required`, { ok: false });
      }

      const event = await DashboardEventItem.create({
        guildId,
        title,
        description: cleanDashboardText(req.body.description, 1200),
        type: ["custom", "festival", "server", "community"].includes(req.body.type) ? req.body.type : "custom",
        channelId: cleanDashboardText(req.body.channelId, 40) || config?.defaultChannelId || "",
        pingMode: ["none", "everyone", "here", "role"].includes(req.body.pingMode) ? req.body.pingMode : "none",
        roleId: cleanDashboardText(req.body.roleId, 40),
        bannerUrl: cleanDashboardText(req.body.bannerUrl, 500),
        startsAt,
        endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
        repeat: ["none", "daily", "weekly", "monthly", "yearly"].includes(req.body.repeat) ? req.body.repeat : "none",
        reminderMinutes: Math.max(0, Math.min(10080, Number(req.body.reminderMinutes || 0))),
        messageMode: ["custom", "ai", "improve"].includes(req.body.messageMode) ? req.body.messageMode : "custom",
        customMessage: cleanDashboardText(req.body.customMessage, 1500),
        createdBy: req.session?.username || req.session?.discordUser?.username || "dashboard",
        createdById: req.session?.discordUser?.id || req.session?.userId || "",
      });

      await logEventCenter(guildId, {
        eventId: String(event._id),
        type: "created",
        title: "Event Created",
        message: `Created event: ${title}`,
        createdBy: event.createdBy,
      });

      return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?success=Event created`, { ok: true });
    } catch (err) {
      console.error("[Event Create Error]", err);
      return redirectWithDashboardError(res, getEventCenterPath(req), "Failed to create event", err);
    }
  });

  app.post("/dashboard/events/festival/create", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const config = await DashboardEventCenterConfig.findOne({ guildId });
      const title = cleanDashboardText(req.body.title, 140);
      const date = req.body.festivalDate ? new Date(`${req.body.festivalDate}T09:00:00`) : null;
      if (!title || !date || Number.isNaN(date.getTime())) {
        return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?error=Festival name and date are required`, { ok: false });
      }

      await DashboardEventItem.create({
        guildId,
        title,
        type: "festival",
        startsAt: date,
        repeat: "yearly",
        channelId: config?.festivalChannelId || config?.defaultChannelId || "",
        messageMode: req.body.customMessage ? "custom" : "ai",
        customMessage: cleanDashboardText(req.body.customMessage, 1500),
        description: "Yearly festival / special-day announcement.",
        createdBy: req.session?.username || req.session?.discordUser?.username || "dashboard",
        createdById: req.session?.discordUser?.id || req.session?.userId || "",
      });

      await logEventCenter(guildId, {
        type: "created",
        title: "Festival Created",
        message: `Created yearly festival: ${title}`,
      });

      return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?success=Festival event created`, { ok: true });
    } catch (err) {
      console.error("[Festival Create Error]", err);
      return redirectWithDashboardError(res, getEventCenterPath(req), "Failed to create festival", err);
    }
  });

  app.post("/dashboard/events/birthdays/create", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const displayName = cleanDashboardText(req.body.displayName, 90);
      const birthdayDate = req.body.birthdayDate ? new Date(`${req.body.birthdayDate}T00:00:00`) : null;

      if (!displayName || !birthdayDate || Number.isNaN(birthdayDate.getTime())) {
        return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?error=Name and birthday date are required`, { ok: false });
      }

      const birthday = await DashboardBirthday.create({
        guildId,
        displayName,
        userId: cleanDashboardText(req.body.userId, 40),
        month: birthdayDate.getMonth() + 1,
        day: birthdayDate.getDate(),
        channelId: cleanDashboardText(req.body.channelId, 40),
        customMessage: cleanDashboardText(req.body.customMessage, 1200),
        aiMessageEnabled: req.body.aiMessageEnabled === "on",
        announceInServer: req.body.announceInServer === "on",
        dmUser: req.body.dmUser === "on",
        createdBy: req.session?.username || req.session?.discordUser?.username || "dashboard",
        createdById: req.session?.discordUser?.id || req.session?.userId || "",
      });

      await logEventCenter(guildId, {
        type: "created",
        title: "Birthday Saved",
        message: `Saved birthday for ${birthday.displayName} on ${birthday.day}/${birthday.month}`,
      });

      return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?success=Birthday saved`, { ok: true });
    } catch (err) {
      console.error("[Birthday Create Error]", err);
      return redirectWithDashboardError(res, getEventCenterPath(req), "Failed to save birthday", err);
    }
  });

  app.post("/dashboard/events/:eventId/announce-now", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      const event = await DashboardEventItem.findOne({ _id: req.params.eventId, guildId });
      if (!event) return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?error=Event not found`, { ok: false });

      const config = await DashboardEventCenterConfig.findOne({ guildId });
      const channelId = event.channelId || config?.defaultChannelId || "";
      const result = await sendEventCenterMessage(guildId, channelId, buildEventAnnouncementText(event, "created"), event.bannerUrl);

      if (!result.ok) {
        return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?error=${encodeURIComponent(result.error)}`, { ok: false });
      }

      event.announceCreatedSentAt = new Date();
      await event.save();

      await logEventCenter(guildId, {
        eventId: String(event._id),
        type: "announced",
        title: "Event Announced",
        message: `Manually announced: ${event.title}`,
        createdBy: req.session?.username || "dashboard",
      });

      return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?success=Event announced`, { ok: true });
    } catch (err) {
      console.error("[Announce Event Now Error]", err);
      return redirectWithDashboardError(res, getEventCenterPath(req), "Failed to announce event", err);
    }
  });

  app.post("/dashboard/events/:eventId/delete", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      await DashboardEventItem.deleteOne({ _id: req.params.eventId, guildId });
      await logEventCenter(guildId, { type: "deleted", title: "Event Deleted", message: `Deleted event ${req.params.eventId}` });
      return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?success=Event deleted`, { ok: true });
    } catch (err) {
      console.error("[Event Delete Error]", err);
      return redirectWithDashboardError(res, getEventCenterPath(req), "Failed to delete event", err);
    }
  });

  app.post("/dashboard/events/birthdays/:birthdayId/delete", requireAuth, requireSelectedGuild, async (req, res) => {
    try {
      const guildId = getGuildId(req);
      await DashboardBirthday.deleteOne({ _id: req.params.birthdayId, guildId });
      await logEventCenter(guildId, { type: "deleted", title: "Birthday Deleted", message: `Deleted birthday ${req.params.birthdayId}` });
      return dashboardJsonOrRedirect(req, res, `${getEventCenterPath(req)}?success=Birthday deleted`, { ok: true });
    } catch (err) {
      console.error("[Birthday Delete Error]", err);
      return redirectWithDashboardError(res, getEventCenterPath(req), "Failed to delete birthday", err);
    }
  });

  async function runEventCenterSchedulerOnce() {
    const now = new Date();

    const dueEvents = await DashboardEventItem.find({
      status: { $nin: ["cancelled", "ended"] },
      startsAt: { $lte: new Date(now.getTime() + 1000 * 60 * 2) },
    }).limit(25);

    for (const event of dueEvents) {
      try {
        const config = await DashboardEventCenterConfig.findOne({ guildId: event.guildId });
        if (!config?.enabled) continue;

        const channelId = event.channelId || config.defaultChannelId || "";
        if (!event.startingSentAt && event.startsAt <= now) {
          const result = await sendEventCenterMessage(event.guildId, channelId, buildEventAnnouncementText(event, "start"), event.bannerUrl);
          if (result.ok) {
            event.startingSentAt = now;
            event.status = "started";
            await logEventCenter(event.guildId, {
              eventId: String(event._id),
              type: "announced",
              title: "Event Started",
              message: `Starting announcement sent for ${event.title}`,
            });
          } else {
            event.lastError = result.error;
          }
        }

        if (event.endsAt && event.endsAt <= now && !event.endedSentAt) {
          const result = await sendEventCenterMessage(event.guildId, channelId, buildEventAnnouncementText(event, "end"), event.bannerUrl);
          if (result.ok) {
            event.endedSentAt = now;
            event.status = "ended";
          }
        }

        const next = event.status === "ended" ? getNextRepeatDate(event.startsAt, event.repeat) : null;
        if (next) {
          event.startsAt = next;
          if (event.endsAt) {
            const duration = event.endsAt.getTime() - event.startsAt.getTime();
            event.endsAt = new Date(next.getTime() + Math.max(0, duration));
          }
          event.status = "scheduled";
          event.announceCreatedSentAt = null;
          event.reminderSentAt = null;
          event.startingSentAt = null;
          event.endedSentAt = null;
        }

        await event.save();
      } catch (err) {
        console.error("[Event Scheduler Event Error]", err.message || String(err));
      }
    }

    const reminderEvents = await DashboardEventItem.find({
      status: "scheduled",
      reminderSentAt: null,
      reminderMinutes: { $gt: 0 },
      startsAt: { $gt: now, $lte: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7) },
    }).limit(40);

    for (const event of reminderEvents) {
      try {
        const config = await DashboardEventCenterConfig.findOne({ guildId: event.guildId });
        if (!config?.enabled || !config?.remindersEnabled) continue;

        const reminderAt = new Date(event.startsAt.getTime() - Number(event.reminderMinutes || 0) * 60 * 1000);
        if (reminderAt > now) continue;

        const channelId = event.channelId || config.defaultChannelId || "";
        const result = await sendEventCenterMessage(event.guildId, channelId, buildEventAnnouncementText(event, "reminder"), event.bannerUrl);
        if (result.ok) {
          event.reminderSentAt = now;
          await event.save();
          await logEventCenter(event.guildId, {
            eventId: String(event._id),
            type: "reminder",
            title: "Reminder Sent",
            message: `Reminder sent for ${event.title}`,
          });
        }
      } catch (err) {
        console.error("[Event Scheduler Reminder Error]", err.message || String(err));
      }
    }

    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const year = today.getFullYear();

    const todaysBirthdays = await DashboardBirthday.find({
      month,
      day,
      lastAnnouncedYear: { $ne: year },
    }).limit(40);

    for (const birthday of todaysBirthdays) {
      try {
        const config = await DashboardEventCenterConfig.findOne({ guildId: birthday.guildId });
        if (!config?.enabled || !config?.birthdayAnnouncementsEnabled) continue;

        let serverOk = false;
        let dmOk = false;

        if (birthday.announceInServer !== false) {
          const channelId = birthday.channelId || config.birthdayChannelId || config.defaultChannelId || "";
          const result = await sendEventCenterMessage(birthday.guildId, channelId, buildBirthdayAnnouncementText(birthday), "");
          serverOk = !!result.ok;
          if (!result.ok) birthday.lastError = result.error;
        }

        if (birthday.dmUser && birthday.userId) {
          const dmResult = await sendBirthdayDm(birthday.userId, buildBirthdayDmText(birthday)).catch((err) => ({ ok: false, error: err.message || String(err) }));
          dmOk = !!dmResult.ok;
        }

        if (serverOk || dmOk || birthday.announceInServer === false) {
          birthday.lastAnnouncedYear = year;
          await birthday.save();
          await logEventCenter(birthday.guildId, {
            type: "birthday",
            title: "Birthday Announced",
            message: `Birthday processed for ${birthday.displayName}. Server: ${serverOk ? "sent" : "skipped/failed"}. DM: ${dmOk ? "sent" : "skipped/failed"}.`,
          });
        }
      } catch (err) {
        console.error("[Event Scheduler Birthday Error]", err.message || String(err));
      }
    }
  }

  setInterval(() => {
    runEventCenterSchedulerOnce().catch((err) => {
      console.error("[Event Center Scheduler Error]", err.message || String(err));
    });
  }, 1000 * 60);


  app.get("/health", (req, res) => {
    res.status(200).json({
      ok: true,
      bot: client.user?.tag || "loading",
      dashboard: "running",
      version: DASHBOARD_VERSION,
      selectedGuildId: req.session?.selectedGuildId || null,
    });
  });

  app.get("/ready", (req, res) => {
    try {
      return res.status(200).json({
        ok: true,
        ready: true,
        service: "legendary-bot-dashboard",
        version: DASHBOARD_VERSION,
        uptime: process.uptime(),
        mongoReadyState: mongoose?.connection?.readyState ?? "unknown",
        botReady: Boolean(client?.isReady?.()),
        botTag: client?.user?.tag || "loading",
        guilds: client?.guilds?.cache?.size || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[Ready Route Error]", err);
      return res.status(200).json({
        ok: false,
        ready: false,
        error: err.message || String(err),
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.use((err, req, res, next) => {
    console.error("Dashboard fatal error:", err);
    res.status(500).send("Internal Server Error");
  });

  restoreDashboardAutoMessages().catch((err) => {
    console.error("[Dashboard Auto Message Restore Error]", err);
  });

  
  // PHASE17L_FINAL_ERROR_HANDLER
  app.use((err, req, res, next) => {
    console.error("[Dashboard Final Error Handler]", {
      path: req.originalUrl || req.url,
      method: req.method,
      message: err?.message || String(err),
      stack: err?.stack || "",
    });

    if (res.headersSent) return next(err);

    const safeMessage =
      process.env.NODE_ENV === "production"
        ? "Internal dashboard error"
        : (err?.message || "Internal dashboard error");

    return res.status(500).send(`
      <main style="font-family: system-ui; padding: 40px; background: #090821; color: #fff; min-height: 100vh;">
        <h1>Dashboard Error</h1>
        <p>${safeMessage}</p>
        <p>Check Railway logs for the exact server-side error.</p>
        <a style="color:#a78bfa;" href="/app">Go back to customer portal</a>
      </main>
    `);
  });

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Legendary Bot Dashboard running on port ${PORT}`);
  });
};

module.exports = startDashboard;
