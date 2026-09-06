/* eslint-disable no-console */
const { EmbedBuilder } = require("discord.js");
const AITicketConfig = require("../models/AITicketConfig");
const AITicketSession = require("../models/AITicketSession");
const aiProviderManager = require("./aiProviderManager");

const TICKET_TYPES = {
  staff_application: {
    label: "Staff Applications",
    introTitle: "🛡️ Staff Application Started",
    intro: "Please answer each question honestly. I will ask one question at a time.",
    questions: [
      ["basic", "1", "What is your Discord username?\n\nWrite your full Discord username so we know who is applying."],
      ["basic", "2", "What is your age?\n\nWrite your real age. This helps us understand your maturity and responsibility level."],
      ["basic", "3", "What is your timezone?\n\nWrite your timezone so we know when you are usually active."],
      ["basic", "4", "How many hours can you be active per day?\n\nWrite how many hours you can help in the server on normal days and weekends."],
      ["basic", "5", "Why do you want to become staff?\n\nExplain why you want to help the server. Do not just say “because I want mod.” Tell us how you can help."],
      ["experience", "6", "Have you ever been staff before?\n\nWrite yes or no. If yes, explain where you were staff before."],
      ["experience", "7", "If yes, what server and what role?\n\nWrite the server name and your role there."],
      ["experience", "8", "Why are you no longer staff there?\n\nExplain honestly why you left or got removed. Do not lie."],
      ["experience", "9", "What moderation bots do you know?\n\nWrite the bots you know how to use."],
      ["experience", "10", "Rate your Discord permissions/audit log knowledge from 1–10.\n\nGive yourself a rating and explain why."],
      ["maturity", "11", "What would you do if someone insults you after a warning?\n\nExplain how you would stay calm and handle it without abusing power."],
      ["maturity", "12", "What would you do if your close friend breaks a serious rule?\n\nExplain if you would treat them fairly like everyone else."],
      ["maturity", "13", "How would you handle two members fighting?\n\nExplain how you would calm them down, warn them, or move the issue to DMs/tickets."],
      ["maturity", "14", "What does being fair as staff mean to you?\n\nExplain what fairness means to you and how staff should treat members."],
      ["maturity", "15", "Why should we trust you with staff permissions?\n\nExplain why you are responsible enough to have staff powers."],
      ["security", "16", "What would you do if someone posts a scam link?\n\nExplain how you would delete the link, warn members, punish the user, and report it to staff."],
      ["security", "17", "What would you do if bot accounts raid the server?\n\nExplain your first actions during a raid."],
      ["security", "18", "What would you do if someone DM advertises members?\n\nExplain how you would check proof and take action based on the rules."],
      ["security", "19", "What would you do if staff abuses power?\n\nExplain how you would collect proof and report it to higher staff or the owner."],
      ["security", "20", "What would you do if someone is toxic but not fully breaking a rule?\n\nExplain if you would warn them first or take stronger action later."],
      ["final", "21", "Are you willing to follow all staff rules?\n\nWrite yes or no. You can also explain that you understand staff rules must be followed."],
      ["final", "22", "Are you okay with removal if you abuse your role?\n\nWrite yes or no. This shows you understand staff power is a responsibility."],
      ["final", "23", "Do you understand staff chat must stay private?\n\nWrite yes or no. Staff chat should never be leaked to normal members."],
      ["final", "24", "What would you improve in this server?\n\nGive one idea to improve the server."],
      ["final", "25", "Any final message?\n\nWrite anything extra you want the owner or staff team to know."],
    ].map(([section, id, text]) => ({ section, id, text })),
  },

  ban_appeal: {
    label: "Ban Appeals",
    introTitle: "🔨 Ban Appeal Started",
    intro: "Please answer honestly. Staff will review the appeal after the questions.",
    questions: [
      ["appeal", "1", "What is your Discord username and user ID?"],
      ["appeal", "2", "Why were you banned? Explain honestly."],
      ["appeal", "3", "When did the ban happen?"],
      ["appeal", "4", "Do you admit what happened? Explain your side."],
      ["appeal", "5", "Why should staff give you another chance?"],
      ["appeal", "6", "What will you do differently if unbanned?"],
    ].map(([section, id, text]) => ({ section, id, text })),
  },

  warn_appeal: {
    label: "Warn Appeals",
    introTitle: "⚠️ Warn Appeal Started",
    intro: "Please answer honestly. Staff will review the warning after the questions.",
    questions: [
      ["appeal", "1", "What is your Discord username and user ID?"],
      ["appeal", "2", "What warning are you appealing?"],
      ["appeal", "3", "Why do you think the warning should be removed or changed?"],
      ["appeal", "4", "Do you have screenshots or proof?"],
      ["appeal", "5", "What will you do differently next time?"],
    ].map(([section, id, text]) => ({ section, id, text })),
  },

  partnership: {
    label: "Partnership",
    introTitle: "🤝 Partnership Application Started",
    intro: "Please answer the partnership questions. Staff will review your server after you finish.",
    questions: [
      ["partner", "1", "What is your server name?"],
      ["partner", "2", "How many members does your server have?"],
      ["partner", "3", "What is your server about?"],
      ["partner", "4", "Why do you want to partner with us?"],
      ["partner", "5", "What can your server offer in the partnership?"],
      ["partner", "6", "Please send your advertisement message or partnership description."],
    ].map(([section, id, text]) => ({ section, id, text })),
  },

  support: {
    label: "Support",
    introTitle: "🛟 Support Ticket Started",
    intro: "Please describe your issue clearly. The bot will collect details and staff will help you.",
    questions: [
      ["support", "1", "What do you need help with?"],
      ["support", "2", "When did the issue start?"],
      ["support", "3", "Please send screenshots, links, or extra details if you have them."],
    ].map(([section, id, text]) => ({ section, id, text })),
  },
};

function cleanText(value, max = 1800) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function looksAiCopied(answer, secondsToAnswer, config) {
  if (!config?.aiCopyDetectionEnabled) return { suspected: false, flags: [] };

  const text = cleanText(answer, 5000);
  const flags = [];
  const minChars = Number(config.aiCopyMinChars || 350);
  const fastSeconds = Number(config.aiCopyFastSeconds || 45);

  const sentenceCount = (text.match(/[.!?]/g) || []).length;
  const commaCount = (text.match(/,/g) || []).length;
  const longWordCount = (text.match(/\b[a-zA-Z]{9,}\b/g) || []).length;
  const hasPolishedPhrases = /(furthermore|moreover|in conclusion|it is important to|i would ensure|appropriate action|maintain professionalism|de-escalate|accountability|responsibility)/i.test(text);

  if (text.length >= minChars && secondsToAnswer > 0 && secondsToAnswer <= fastSeconds) {
    flags.push("long_answer_typed_too_fast");
  }

  if (text.length >= minChars && sentenceCount >= 5 && commaCount >= 4 && longWordCount >= 8) {
    flags.push("highly_polished_long_answer");
  }

  if (text.length >= minChars && hasPolishedPhrases) {
    flags.push("ai_like_phrase_pattern");
  }

  return {
    suspected: flags.length > 0,
    flags,
  };
}

function localAnswerScore(answer, question, secondsToAnswer = 0, config = {}) {
  const text = cleanText(answer, 4000);
  const lower = text.toLowerCase();
  let score = 4;
  const flags = [];

  if (text.length >= 40) score += 2;
  if (text.length >= 120) score += 2;
  if (text.length >= 250) score += 1;

  if (/\byes\b|\bno\b/i.test(text) && text.length < 20) {
    score -= 2;
    flags.push("very_short_yes_no");
  }

  if (/(idk|dunno|don't know|dont know|because i want mod|for power|give me admin)/i.test(lower)) {
    score -= 3;
    flags.push("low_effort_or_power_focused");
  }

  if (/(fair|calm|proof|evidence|warn|mute|report|staff|rules|responsib|help|respect|privacy|scam|raid|delete)/i.test(lower)) {
    score += 2;
  }

  if (/(abuse|leak|raid|scam|spam)/i.test(lower) && question?.section !== "security") {
    flags.push("sensitive_word_used");
  }

  score = Math.max(0, Math.min(10, score));

  const aiCopy = looksAiCopied(text, secondsToAnswer, config);
  if (aiCopy.suspected) {
    flags.push("ai_copy_suspected", ...aiCopy.flags);

    // If an answer looks too perfect and too fast, don't destroy it;
    // cap an otherwise 10/10 style answer to configurable score, default 7/10.
    const cap = Math.max(1, Math.min(10, Number(config.aiCopyScoreCap || 7)));
    if (score > cap) score = cap;
  }

  return { score, flags: [...new Set(flags)], aiCopySuspected: aiCopy.suspected };
}

function scoreToColor(recommendation) {
  if (recommendation === "pass") return 0x22c55e;
  if (recommendation === "reject") return 0xef4444;
  return 0xf59e0b;
}

function getTypeConfig(config, typeKey) {
  return (config?.types || []).find((type) => type.key === typeKey);
}

function getTypeByCategory(config, categoryId) {
  return (config?.types || []).find((type) => type.enabled !== false && type.categoryId && type.categoryId === categoryId);
}

async function getOrCreateConfig(guild) {
  let config = await AITicketConfig.findOneWithMainFallback({ guildId: guild.id }).catch(() => null);

  if (!config) {
    config = await AITicketConfig.create({
      guildId: guild.id,
      guildName: guild.name,
    });
  }

  config.types = AITicketConfig.normalizeTypes(config.types || []);

  return config;
}

function buildQuestionEmbed(typeDef, session, question) {
  const total = typeDef.questions.length;
  const index = session.currentQuestionIndex + 1;

  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(`${typeDef.introTitle}`)
    .setDescription(`**Question ${index}/${total}**\n\n${question.text}\n\nReply in this ticket with your answer. You can send multiple messages. When your answer is finished, type **$next**.`)
    .setFooter({ text: "Type $cancelapplication to cancel this AI ticket flow." })
    .setTimestamp();
}

function buildIntroEmbed(typeDef) {
  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(typeDef.introTitle)
    .setDescription(`${typeDef.intro}\n\nI will ask questions one at a time. Please do not spam answers.`)
    .setTimestamp();
}

function localFinalAnalysis(session, config) {
  const answered = session.answers || [];
  const localTotal = answered.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const possible = Math.max(answered.length * 10, 1);
  const finalScoreMax = Math.max(10, Math.min(1000, Number(config.finalScoreMax || 100)));
  let score = Math.round((localTotal / possible) * finalScoreMax);

  const joined = answered.map((a) => a.answer).join(" ").toLowerCase();
  const flags = [...new Set(answered.flatMap((a) => a.flags || []))];

  if (/(power|admin perms|abuse|raid|nuke)/i.test(joined)) {
    score -= 15;
    flags.push("risk_language");
  }

  if (/(privacy|private|staff chat|proof|fair|calm|responsib|rules|respect)/i.test(joined)) score += 8;
  if (/(2|3|4|5|6|7|8|9|10)\s*(hours|hrs|h)\b/i.test(joined)) score += 5;

  score = Math.max(0, Math.min(finalScoreMax, score));

  const passScore = Number(config.passScore || 100);
  const staffReviewMinScore = Number(config.staffReviewMinScore || 75);

  const recommendation = score >= passScore ? "pass" : score >= staffReviewMinScore ? "review" : "reject";

  return {
    provider: "local",
    model: "local",
    raw: "",
    score,
    maturity: Math.min(10, Math.max(0, Math.round(score / 12))),
    trust: Math.min(10, Math.max(0, Math.round(score / 13))),
    activity: Math.min(10, Math.max(0, Math.round(score / 14))),
    experience: Math.min(10, Math.max(0, Math.round(score / 15))),
    risk: recommendation === "reject" ? 7 : recommendation === "review" ? 4 : 2,
    recommendation,
    summary:
      recommendation === "pass"
        ? "Applicant passed the configured score threshold. Staff should still confirm before giving permissions."
        : recommendation === "review"
          ? "Applicant is in the review zone. Staff should manually inspect the answers."
          : "Applicant scored below the configured review threshold and was auto rejected by the configured rule.",
    flags,
  };
}

async function aiFinalAnalysis(session, config) {
  if (!config.aiEnabled) return localFinalAnalysis(session, config);

  const local = localFinalAnalysis(session, config);

  if (!aiProviderManager.hasAnyProvider()) return local;

  const system = [
    "You are a Discord server staff application and ticket review assistant.",
    "You must be fair, careful, and concise.",
    "Never claim someone is accepted as staff automatically. You only recommend.",
    "Return JSON only.",
    "JSON shape: { score:number, maturity:number, trust:number, activity:number, experience:number, risk:number, recommendation:'pass'|'review'|'reject', summary:string, flags:string[] }",
    "Score is out of the configured finalScoreMax. User can pass only if score is greater than or equal to pass threshold.",
  ].join("\n");

  const prompt = JSON.stringify({
    ticketType: session.typeKey,
    finalScoreMax: config.finalScoreMax || 100,
    passScore: config.passScore,
    staffReviewMinScore: config.staffReviewMinScore,
    localPreScore: local.score,
    answers: (session.answers || []).map((answer) => ({
      question: answer.questionText,
      answer: answer.answer,
      localScore: answer.score,
      flags: answer.flags,
      section: answer.section,
    })),
  }, null, 2);

  const ai = await aiProviderManager.completeJson({
    system,
    prompt,
    preferredProvider: config.preferredProvider || "auto",
  });

  const json = ai.json || {};
  const finalScoreMax = Math.max(10, Math.min(1000, Number(config.finalScoreMax || 100)));
  const score = Math.max(0, Math.min(finalScoreMax, Number(json.score || local.score)));
  const passScore = Number(config.passScore || 100);
  const staffReviewMinScore = Number(config.staffReviewMinScore || 75);
  const recommendation = score >= passScore ? "pass" : score >= staffReviewMinScore ? "review" : "reject";

  return {
    provider: ai.provider || "local",
    model: ai.model || "local",
    raw: ai.raw || "",
    score,
    maturity: Number(json.maturity || local.maturity || 0),
    trust: Number(json.trust || local.trust || 0),
    activity: Number(json.activity || local.activity || 0),
    experience: Number(json.experience || local.experience || 0),
    risk: Number(json.risk || local.risk || 0),
    recommendation,
    summary: cleanText(json.summary || local.summary, 1000),
    flags: [...new Set([...(local.flags || []), ...((Array.isArray(json.flags) ? json.flags : []))])],
  };
}

function buildReviewEmbed(session) {
  const result = session.finalResult || {};
  const applicant = session.applicantId ? `<@${session.applicantId}>` : session.applicantTag || "Unknown";
  const recommendation =
    result.recommendation === "pass" ? "✅ PASSED THRESHOLD" :
    result.recommendation === "reject" ? "❌ AUTO REJECTED" :
    "🟡 NEEDS STAFF REVIEW";

  return new EmbedBuilder()
    .setColor(scoreToColor(result.recommendation))
    .setTitle(`🤖 AI Ticket Review — ${session.typeLabel || session.typeKey}`)
    .setDescription([
      `**Applicant:** ${applicant}`,
      `**Ticket:** <#${session.channelId}>`,
      `**Result:** ${recommendation}`,
      `**Score:** ${result.score || 0}/${session.finalScoreMax || 100}`,
      "",
      `**Summary:** ${result.summary || "No summary."}`,
    ].join("\n"))
    .addFields(
      { name: "Maturity", value: `${result.maturity || 0}/10`, inline: true },
      { name: "Trust", value: `${result.trust || 0}/10`, inline: true },
      { name: "Activity", value: `${result.activity || 0}/10`, inline: true },
      { name: "Experience", value: `${result.experience || 0}/10`, inline: true },
      { name: "Risk", value: `${result.risk || 0}/10`, inline: true },
      { name: "AI Provider", value: `${result.provider || "local"} / ${result.model || "local"}`, inline: true },
      { name: "Flags", value: (result.flags || []).length ? result.flags.slice(0, 12).map((f) => `• ${f}`).join("\n") : "None", inline: false }
    )
    .setFooter({ text: "AI recommendation only. Staff/owner should make the final decision." })
    .setTimestamp();
}

async function sendReview(client, session, config) {
  const typeCfg = getTypeConfig(config, session.typeKey);
  const channelId = session.reviewChannelId || typeCfg?.reviewChannelId;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const pingRole = typeCfg?.pingRoleId ? `<@&${typeCfg.pingRoleId}> ` : "";
  const result = session.finalResult || {};
  const content =
    result.recommendation === "review"
      ? `${pingRole}🟡 **AI ticket needs staff review.**`
      : result.recommendation === "pass"
        ? `${pingRole}✅ **AI ticket passed the configured threshold. Staff confirm before giving roles.**`
        : `${pingRole}❌ **AI ticket auto rejected by configured score rule.**`;

  const sent = await channel.send({
    content,
    embeds: [buildReviewEmbed(session)],
  });

  session.reviewMessageId = sent.id;
  await session.save();
}


function buildTranscriptText(session) {
  const lines = [];
  lines.push(`AI Ticket Report — ${session.typeLabel || session.typeKey}`);
  lines.push(`Applicant: ${session.applicantTag || session.applicantId || "Unknown"}`);
  lines.push(`Ticket Channel ID: ${session.channelId}`);
  lines.push(`Final Score: ${session.finalScore}/${session.finalScoreMax || 100}`);
  lines.push(`Status: ${session.status}`);
  lines.push("");

  for (const answer of session.answers || []) {
    lines.push(`Q${answer.questionId}: ${answer.questionText}`);
    lines.push(`Answer: ${answer.answer || "No answer"}`);
    lines.push(`Score: ${answer.score}/10${answer.aiCopySuspected ? " | AI-copy suspected" : ""}`);
    if ((answer.flags || []).length) lines.push(`Flags: ${(answer.flags || []).join(", ")}`);
    lines.push("");
  }

  lines.push("Final AI/Local Summary:");
  lines.push(session.finalResult?.summary || "No summary.");

  return lines.join("\n").slice(0, 18000);
}

async function sendWebhookReport(session, config) {
  const url = String(config.reportWebhookUrl || "").trim();
  if (!url || !/^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks\/\d+\/[\w-]+/i.test(url)) return false;

  // Send the report as JSON text; no unused multipart payload is constructed.
  const textPayload = {
    username: "Legendary AI Tickets",
    content: `🤖 **AI Ticket Report** for <#${session.channelId}>\n\n\`\`\`txt\n${buildTranscriptText(session).slice(0, 1800)}\n\`\`\``,
    embeds: [buildReviewEmbed(session).toJSON()],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(textPayload),
  });

  return response.ok;
}


class AITicketManager {
  constructor() {
    this.client = null;
    this.started = false;
  }

  init(client) {
    this.client = client;

    if (!this.started) {
      this.started = true;
      setInterval(() => this.checkPendingPings().catch((err) => console.error("[AI Ticket Pending Ping Error]", err)), 5 * 60 * 1000);
      setInterval(() => this.checkTimeouts().catch((err) => console.error("[AI Ticket Timeout Error]", err)), 10 * 60 * 1000);
    }

    console.log("🤖 AI Ticket Manager ready");
  }

  async handleChannelCreate(channel) {
    try {
      if (!channel?.guild || !channel?.parentId || !channel.isTextBased?.()) return false;

      // TicketTool may create permissions/messages after channel create, so wait a little.
      setTimeout(() => this.tryStartForChannel(channel.id).catch((err) => console.error("[AI Ticket Start Delayed Error]", err)), 3500);

      return true;
    } catch (err) {
      console.error("[AI Ticket Channel Create Error]", err);
      return false;
    }
  }

  async tryStartForChannel(channelId) {
    const channel = await this.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.guild || !channel?.parentId || !channel.isTextBased?.()) return false;

    const guild = channel.guild;
    const config = await getOrCreateConfig(guild);

    if (!config.enabled) return false;

    const typeCfg = getTypeByCategory(config, channel.parentId);
    if (!typeCfg) return false;

    const typeDef = TICKET_TYPES[typeCfg.key];
    if (!typeDef) return false;

    const existing = await AITicketSession.findOneWithMainFallback({ channelId: channel.id }).catch(() => null);
    if (existing) return false;

    const applicant = await this.detectApplicant(channel);

    const session = await AITicketSession.create({
      guildId: guild.id,
      guildName: guild.name,
      channelId: channel.id,
      channelName: channel.name,
      categoryId: channel.parentId,
      typeKey: typeCfg.key,
      typeLabel: typeCfg.label || typeDef.label,
      applicantId: applicant?.id || "",
      applicantTag: applicant?.tag || "",
      reviewChannelId: typeCfg.reviewChannelId || "",
      currentQuestionIndex: 0,
      currentQuestionStartedAt: new Date(),
      currentAnswerParts: [],
      status: "active",
      lastActivityAt: new Date(),
    });

    await channel.send({
      content: applicant?.id ? `<@${applicant.id}>` : undefined,
      embeds: [buildIntroEmbed(typeDef)],
    }).catch(() => null);

    await this.sendCurrentQuestion(channel, session);

    return true;
  }

  async detectApplicant(channel) {
    try {
      const messages = await channel.messages.fetch({ limit: 15 }).catch(() => null);
      if (!messages) return null;

      const nonBot = messages
        .filter((message) => !message.author.bot)
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .first();

      if (nonBot) return nonBot.author;

      // TicketTool often grants the opener ViewChannel permission. Pick first non-bot non-role overwrite.
      const overwrite = channel.permissionOverwrites.cache.find((ow) => ow.type === 1 && ow.id !== channel.guild.members.me?.id);
      if (overwrite) {
        const member = await channel.guild.members.fetch(overwrite.id).catch(() => null);
        if (member) return member.user;
      }

      return null;
    } catch {
      return null;
    }
  }

  async sendCurrentQuestion(channel, session) {
    const typeDef = TICKET_TYPES[session.typeKey];
    if (!typeDef) return;

    const question = typeDef.questions[session.currentQuestionIndex];
    if (!question) {
      await this.completeSession(channel, session);
      return;
    }

    session.currentQuestionStartedAt = new Date();
    session.currentAnswerParts = [];
    await session.save().catch(() => null);

    await channel.send({
      embeds: [buildQuestionEmbed(typeDef, session, question)],
    });
  }

  async handleMessage(message) {
    try {
      if (!message.guild || message.author.bot || !message.channel?.id) return false;

      const session = await AITicketSession.findOneWithMainFallback({
        channelId: message.channel.id,
        status: "active",
      }).catch(() => null);

      if (!session) return false;

      const content = message.content.trim();
      const lower = content.toLowerCase();

      if (lower === "$cancelapplication") {
        session.status = "cancelled";
        session.completedAt = new Date();
        session.lastActivityAt = new Date();
        await session.save();

        await message.reply("✅ AI ticket flow cancelled. Staff can still help you manually.").catch(() => null);
        return true;
      }

      if (!session.applicantId) {
        session.applicantId = message.author.id;
        session.applicantTag = message.author.tag;
      }

      if (session.applicantId && message.author.id !== session.applicantId) {
        return false;
      }

      const typeDef = TICKET_TYPES[session.typeKey];
      if (!typeDef) return false;

      const question = typeDef.questions[session.currentQuestionIndex];
      if (!question) return false;

      const config = await getOrCreateConfig(message.guild);

      if (lower === "$back") {
        if (session.currentQuestionIndex <= 0 || !session.answers.length) {
          await message.reply("❌ You are already on the first question.").catch(() => null);
          return true;
        }

        const last = session.answers.pop();
        session.currentQuestionIndex = Math.max(0, session.currentQuestionIndex - 1);
        session.currentAnswerParts = (last.parts || []).map((part) => ({ ...part }));
        session.lastActivityAt = new Date();
        await session.save();

        await message.reply("↩️ Moved back one question. Continue editing your answer, then type `$next`.").catch(() => null);
        await this.sendCurrentQuestion(message.channel, session);
        return true;
      }

      if (lower === "$finish") {
        if ((session.currentAnswerParts || []).length) {
          await this.lockCurrentAnswer(message, session, question, config);
        }

        await this.completeSession(message.channel, session);
        return true;
      }

      if (lower === "$next") {
        if (!(session.currentAnswerParts || []).length) {
          await message.reply("❌ Please type your answer first, then use `$next`.").catch(() => null);
          return true;
        }

        await this.lockCurrentAnswer(message, session, question, config);

        if (session.currentQuestionIndex >= typeDef.questions.length) {
          await this.completeSession(message.channel, session);
        } else {
          await this.sendCurrentQuestion(message.channel, session);
        }

        return true;
      }

      const answerPart = cleanText(message.content, 1800);
      if (!answerPart || answerPart.length < 2) return true;

      const startedAt = session.currentQuestionStartedAt ? new Date(session.currentQuestionStartedAt) : new Date();
      const secondsSinceQuestion = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));

      session.currentAnswerParts.push({
        content: answerPart,
        authorId: message.author.id,
        messageId: message.id,
        createdAt: new Date(),
        secondsSinceQuestion,
      });

      session.lastActivityAt = new Date();
      await session.save();

      await message.react("📝").catch(() => null);
      return true;
    } catch (err) {
      console.error("[AI Ticket Message Error]", err);
      return false;
    }
  }

  async lockCurrentAnswer(message, session, question, config) {
    const parts = session.currentAnswerParts || [];
    const answer = cleanText(parts.map((part) => part.content).join("\n"), 4000);
    const startedAt = session.currentQuestionStartedAt ? new Date(session.currentQuestionStartedAt) : new Date();
    const answeredAt = new Date();
    const secondsToAnswer = Math.max(0, Math.round((answeredAt.getTime() - startedAt.getTime()) / 1000));

    const local = localAnswerScore(answer, question, secondsToAnswer, config);

    session.answers.push({
      questionId: question.id,
      questionText: question.text,
      answer,
      section: question.section,
      score: local.score,
      flags: local.flags,
      aiCopySuspected: local.aiCopySuspected,
      startedAt,
      answeredAt,
      secondsToAnswer,
      parts,
    });

    session.localScore = session.answers.reduce((sum, item) => sum + Number(item.score || 0), 0);
    session.currentQuestionIndex += 1;
    session.currentAnswerParts = [];
    session.currentQuestionStartedAt = new Date();
    session.lastActivityAt = new Date();

    await session.save();

    await message.reply(`✅ Answer saved for question ${question.id}.`).catch(() => null);
  }

  async completeSession(channel, session) {
    const config = await getOrCreateConfig(channel.guild);
    const result = await aiFinalAnalysis(session, config);

    session.finalResult = result;
    session.finalScore = result.score;
    session.finalScoreMax = Number(config.finalScoreMax || 100);
    session.completedAt = new Date();
    session.lastActivityAt = new Date();

    if (result.recommendation === "pass") {
      const hasAiCopyFlags = (result.flags || []).some((flag) => String(flag).includes("ai_copy"));
      const shouldAutoApprove =
        config.autoApproveEnabled &&
        config.autoApproveRoleId &&
        (!config.autoApproveOnlyIfNoAiFlags || !hasAiCopyFlags);

      if (shouldAutoApprove && session.applicantId) {
        const member = await channel.guild.members.fetch(session.applicantId).catch(() => null);
        if (member) {
          await member.roles.add(config.autoApproveRoleId, "AI Ticket auto approve threshold met").catch((err) => {
            console.error("[AI Ticket Auto Approve Role Error]", err);
          });
          session.status = "auto_approved";
          session.autoApprovedRoleId = config.autoApproveRoleId;
          session.autoApprovedAt = new Date();
        } else {
          session.status = "passed";
        }
      } else {
        session.status = "passed";
      }
    } else if (result.recommendation === "review") {
      session.status = "pending_review";
      session.nextPingAt = new Date(Date.now() + Number(config.pendingPingMinutes || 30) * 60 * 1000);
    } else {
      session.status = "rejected";
    }

    await session.save();

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(scoreToColor(result.recommendation))
          .setTitle("✅ AI Ticket Questions Finished")
          .setDescription(
            result.recommendation === "pass"
              ? "Your answers passed the configured score threshold. Staff will still review before any final decision."
              : result.recommendation === "review"
                ? "Your answers were sent to staff for manual review."
                : "Your application/appeal was auto rejected by the configured score rule. Staff can still manually review if they choose."
          )
          .addFields({ name: "Score", value: `${result.score}/${config.finalScoreMax || 100}`, inline: true })
          .setTimestamp(),
      ],
    }).catch(() => null);

    await sendReview(this.client, session, config).catch((err) => console.error("[AI Ticket Review Send Error]", err));
    await sendWebhookReport(session, config).catch((err) => console.error("[AI Ticket Webhook Report Error]", err));
  }

  async checkPendingPings() {
    if (!this.client) return;

    const sessions = await AITicketSession.find({
      status: "pending_review",
      nextPingAt: { $lte: new Date() },
    }).limit(25).catch(() => []);

    for (const session of sessions) {
      const guild = this.client.guilds.cache.get(session.guildId);
      if (!guild) continue;

      const config = await getOrCreateConfig(guild);
      const typeCfg = getTypeConfig(config, session.typeKey);
      const reviewChannelId = session.reviewChannelId || typeCfg?.reviewChannelId;
      const channel = reviewChannelId ? await this.client.channels.fetch(reviewChannelId).catch(() => null) : null;

      if (channel) {
        const pingRole = typeCfg?.pingRoleId ? `<@&${typeCfg.pingRoleId}> ` : "";
        await channel.send({
          content: `${pingRole}⏰ Reminder: <#${session.channelId}> still needs staff review. Score: **${session.finalScore}/${config.finalScoreMax || 100}**`,
        }).catch(() => null);
      }

      session.pingCount += 1;
      session.nextPingAt = new Date(Date.now() + Number(config.pendingPingMinutes || 30) * 60 * 1000);
      await session.save().catch(() => null);
    }
  }

  async checkTimeouts() {
    if (!this.client) return;

    const configs = await AITicketConfig.find({ enabled: true }).catch(() => []);

    for (const config of configs) {
      const timeoutMs = Number(config.sessionTimeoutMinutes || 60) * 60 * 1000;
      const cutoff = new Date(Date.now() - timeoutMs);

      const sessions = await AITicketSession.find({
        guildId: config.guildId,
        status: "active",
        lastActivityAt: { $lte: cutoff },
      }).limit(25).catch(() => []);

      for (const session of sessions) {
        session.status = "timeout";
        session.completedAt = new Date();
        await session.save().catch(() => null);

        const channel = await this.client.channels.fetch(session.channelId).catch(() => null);
        if (channel) {
          await channel.send("⏰ This AI ticket flow timed out because there was no answer for too long. Staff can still help manually.").catch(() => null);
        }
      }
    }
  }
}

const manager = new AITicketManager();
manager.TICKET_TYPES = TICKET_TYPES;
module.exports = manager;
