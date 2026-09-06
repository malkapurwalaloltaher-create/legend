const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
} = require("discord.js");
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "../data/roast-config.json");
const USAGE_PATH = path.join(__dirname, "../data/roast-usage.json");

const ROAST_COOLDOWN_MS = 30 * 1000;
const ROAST_DAILY_LIMIT = 10;

function ensureJsonFile(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

function getConfig() {
  ensureJsonFile(CONFIG_PATH, {});
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function getUsage() {
  ensureJsonFile(USAGE_PATH, {});
  try {
    return JSON.parse(fs.readFileSync(USAGE_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveUsage(data) {
  ensureJsonFile(USAGE_PATH, {});
  fs.writeFileSync(USAGE_PATH, JSON.stringify(data, null, 2));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isAdminLike(member) {
  if (!member?.permissions) return false;
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild)
  );
}

function checkRoastAccess(userId, member) {
  if (isAdminLike(member)) {
    return { ok: true, bypass: true };
  }

  const usage = getUsage();
  const today = getTodayKey();

  if (!usage[userId] || usage[userId].day !== today) {
    usage[userId] = {
      day: today,
      count: 0,
      lastUsedAt: 0,
    };
    saveUsage(usage);
  }

  const userData = usage[userId];
  const now = Date.now();

  const remainingCooldown = ROAST_COOLDOWN_MS - (now - userData.lastUsedAt);
  if (remainingCooldown > 0) {
    return {
      ok: false,
      reason: "cooldown",
      remainingMs: remainingCooldown,
    };
  }

  if (userData.count >= ROAST_DAILY_LIMIT) {
    return {
      ok: false,
      reason: "daily_limit",
      remainingMs: 0,
    };
  }

  return { ok: true };
}

function recordRoastUse(userId, member) {
  if (isAdminLike(member)) return;

  const usage = getUsage();
  const today = getTodayKey();

  if (!usage[userId] || usage[userId].day !== today) {
    usage[userId] = {
      day: today,
      count: 0,
      lastUsedAt: 0,
    };
  }

  usage[userId].count += 1;
  usage[userId].lastUsedAt = Date.now();
  saveUsage(usage);
}

function formatSeconds(ms) {
  return Math.ceil(ms / 1000);
}

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
});

const STYLE_PROMPTS = {
  soft: `
Style: light teasing, playful, funny, not too harsh.

Rules:
- Roast must be between 50 and 100 words.
- Make it witty and detailed.
- No slurs.
- No threats.
- No hate speech.
- Do not overuse the same insult word.
- Keep it playful and entertaining.
`,
  savage: `
Style: savage, sharp, smug, group-chat roast energy.

Rules:
- Roast must be between 50 and 100 words.
- Make it brutal, detailed, and creative.
- No slurs.
- No threats.
- No hate speech.
- Do NOT overuse words like "pathetic", "loser", "cringe", or "embarrassing".
- Can use internet slang like "L", "cooked", "bro", "skill issue", "NPC", "touch grass".
`,
  nuclear: `
Style: nuclear meme roast, dramatic, chaotic, internet-heavy.

Rules:
- Roast must be between 50 and 100 words.
- Make it hit hard with meme / internet energy.
- No slurs.
- No threats.
- No hate speech.
- Do NOT overuse words like "pathetic", "loser", "cringe", or "embarrassing".
- Can use slang like "L", "cooked", "delulu", "bro", "skill issue", "NPC", "touch grass", "SYBAU".
`,
  unhinged: `
Style: unhinged, chaotic, absurdly overconfident, terminally online.

Rules:
- Roast must be between 50 and 100 words.
- Make it wild, creative, and over-the-top.
- No slurs.
- No threats.
- No hate speech.
- Do NOT overuse words like "pathetic", "loser", "cringe", or "embarrassing".
- Can use slang like "L", "cooked", "delulu", "bro", "skill issue", "NPC", "touch grass", "SYBAU".
`,
};

function normalizeStyle(style) {
  return ["soft", "savage", "nuclear", "unhinged"].includes(style) ? style : "savage";
}

function pickRandomStyle() {
  const styles = ["soft", "savage", "nuclear", "unhinged"];
  return styles[Math.floor(Math.random() * styles.length)];
}

function buildRoastPrompt(targetName, style = "savage") {
  style = normalizeStyle(style);

  return `
You are a Discord roast bot.

Roast the person named "${targetName}".

${STYLE_PROMPTS[style]}

Output:
- Just the roast.
- No intro.
- No explanation.
- Keep it between 50 and 100 words.
- Make each sentence feel different from the last.
- End with a complete final sentence.
- Never cut off mid-sentence.
`;
}

function buildComebackPrompt(userName, userRoast, style = "savage") {
  style = normalizeStyle(style);

  return `
You are a Discord roast bot.

A user named "${userName}" tried roasting you with:
"${userRoast}"

Now reply with a comeback roast in this style:

${STYLE_PROMPTS[style]}

Output:
- Just the comeback roast.
- No intro.
- No explanation.
- Keep it between 50 and 100 words.
- Make each sentence feel different from the last.
- Use their own roast against them when possible.
- End with a complete final sentence.
- Never cut off mid-sentence.
`;
}

async function generateRoast(targetName, style = "savage") {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: buildRoastPrompt(targetName, style),
    config: { maxOutputTokens: 1200 },
  });

  return response.text?.trim() || "Bro got roasted so hard the Wi-Fi lagged.";
}

async function generateComebackRoast(userName, userRoast, style = "savage") {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: buildComebackPrompt(userName, userRoast, style),
    config: { maxOutputTokens: 1200 },
  });

  return response.text?.trim() || "That roast was so weak it needed life support.";
}

function buildRoastBackButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("roastback_open")
      .setLabel("🔥 Roast Back")
      .setStyle(ButtonStyle.Danger)
  );
}

function buildRoastBackStyleButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("roastback_style_soft")
      .setLabel("Soft")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("roastback_style_savage")
      .setLabel("Savage")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("roastback_style_nuclear")
      .setLabel("Nuclear Meme Roast")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("roastback_style_unhinged")
      .setLabel("Unhinged")
      .setStyle(ButtonStyle.Success)
  );
}

function buildRoastModal(style = "savage") {
  style = normalizeStyle(style);

  return new ModalBuilder()
    .setCustomId(`roastback_modal_${style}`)
    .setTitle(`🔥 Roast Back — ${style.toUpperCase()}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("user_roast")
          .setLabel("Your Roast")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Type your roast here...")
          .setRequired(true)
          .setMaxLength(500)
      )
    );
}

function getRoastChannel(guildId) {
  const config = getConfig();
  return config[guildId]?.roastChannel || null;
}

function getBlockedMessage(userId, member) {
  const check = checkRoastAccess(userId, member);

  if (check.ok) return null;

  if (check.reason === "cooldown") {
    return `⏳ Chill bro, wait ${formatSeconds(check.remainingMs)}s before using roast again.`;
  }

  if (check.reason === "daily_limit") {
    return `🚫 You reached your daily roast limit (${ROAST_DAILY_LIMIT}/day). Come back tomorrow.`;
  }

  return "❌ You can't use roast right now.";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roast")
    .setDescription("Roast someone with AI 🔥")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("The person to roast").setRequired(true)
    ),

  async execute(interaction) {
    const roastChannel = getRoastChannel(interaction.guildId);
    if (roastChannel && interaction.channelId !== roastChannel) {
      return interaction.reply({
        content: `❌ Roasts are only allowed in <#${roastChannel}>. Take it there! 🔥`,
        ephemeral: true,
      });
    }

    const blocked = getBlockedMessage(interaction.user.id, interaction.member);
    if (blocked) {
      return interaction.reply({
        content: blocked,
        ephemeral: true,
      });
    }

    const target = interaction.options.getUser("user");
    const targetName = target.globalName ?? target.username;
    const style = pickRandomStyle();

    await interaction.deferReply();
    recordRoastUse(interaction.user.id, interaction.member);

    try {
      const roast = await generateRoast(targetName, style);
      await interaction.editReply({
        content: `🔥 **Roasting ${target}...**\n\n${roast}`,
        components: [buildRoastBackButton()],
      });
    } catch (err) {
      console.error("Roast error:", err);
      await interaction.editReply("❌ Couldn't generate a roast right now. Try again.");
    }
  },

  async executePrefix(message) {
    const roastChannel = getRoastChannel(message.guildId);
    if (roastChannel && message.channelId !== roastChannel) {
      return message.reply(`❌ Roasts are only allowed in <#${roastChannel}>. Take it there! 🔥`);
    }

    const blocked = getBlockedMessage(message.author.id, message.member);
    if (blocked) {
      return message.reply(blocked);
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply("❌ You need to mention someone to roast! Usage: `$roast @user`");
    }

    const targetName = target.globalName ?? target.username;
    const style = pickRandomStyle();

    const reply = await message.reply("🔥 Cooking up a roast...");
    recordRoastUse(message.author.id, message.member);

    try {
      const roast = await generateRoast(targetName, style);
      await reply.edit({
        content: `🔥 **Roasting ${target}...**\n\n${roast}`,
        components: [buildRoastBackButton()],
      });
    } catch (err) {
      console.error("Roast error:", err);
      await reply.edit("❌ Couldn't generate a roast right now. Try again.");
    }
  },

  generateComebackRoast,
  buildRoastBackButton,
  buildRoastBackStyleButtons,
  buildRoastModal,
  checkRoastAccess,
  recordRoastUse,
  getBlockedMessage,
};