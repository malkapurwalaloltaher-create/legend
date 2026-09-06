/* eslint-disable no-console */
const { GoogleGenAI } = require("@google/genai");

function splitKeys(value) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function getGeminiKeys() {
  const keys = [];
  for (let i = 1; i <= 5; i += 1) {
    if (process.env[`GEMINI_API_KEY_${i}`]) keys.push(process.env[`GEMINI_API_KEY_${i}`]);
    if (process.env[`AI_INTEGRATIONS_GEMINI_API_KEY_${i}`]) keys.push(process.env[`AI_INTEGRATIONS_GEMINI_API_KEY_${i}`]);
  }

  if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
  if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY) keys.push(process.env.AI_INTEGRATIONS_GEMINI_API_KEY);

  return [...new Set(keys.filter(Boolean))];
}

function getGroqKeys() {
  return [
    ...splitKeys(process.env.GROQ_API_KEYS),
    ...[1, 2, 3, 4, 5].map((i) => process.env[`GROQ_API_KEY_${i}`]).filter(Boolean),
    process.env.GROQ_API_KEY,
  ].filter(Boolean);
}

function getOpenRouterKeys() {
  return [
    ...splitKeys(process.env.OPENROUTER_API_KEYS),
    ...[1, 2, 3, 4, 5].map((i) => process.env[`OPENROUTER_API_KEY_${i}`]).filter(Boolean),
    process.env.OPENROUTER_API_KEY,
  ].filter(Boolean);
}

function safeJsonParse(text) {
  try {
    const clean = String(text || "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const first = clean.indexOf("{");
    const last = clean.lastIndexOf("}");

    if (first !== -1 && last !== -1 && last > first) {
      return JSON.parse(clean.slice(first, last + 1));
    }

    return JSON.parse(clean);
  } catch {
    return null;
  }
}

class AIProviderManager {
  constructor() {
    this.keyCursor = {
      groq: 0,
      openrouter: 0,
      gemini: 0,
    };
  }

  hasAnyProvider() {
    return Boolean(getGroqKeys().length || getOpenRouterKeys().length || getGeminiKeys().length);
  }

  nextKey(provider) {
    const keys =
      provider === "groq" ? getGroqKeys() :
      provider === "openrouter" ? getOpenRouterKeys() :
      provider === "gemini" ? getGeminiKeys() :
      [];

    if (!keys.length) return null;

    const cursor = this.keyCursor[provider] || 0;
    const key = keys[cursor % keys.length];
    this.keyCursor[provider] = (cursor + 1) % keys.length;

    return key;
  }

  getProviderOrder(preferred = "auto") {
    if (preferred && preferred !== "auto") return [preferred, "groq", "openrouter", "gemini", "local"].filter((v, i, a) => a.indexOf(v) === i);
    return ["groq", "openrouter", "gemini", "local"];
  }

  async completeJson({ system, prompt, preferredProvider = "auto" }) {
    const order = this.getProviderOrder(preferredProvider);
    let lastError = null;

    for (const provider of order) {
      try {
        if (provider === "groq") return await this.callGroq(system, prompt);
        if (provider === "openrouter") return await this.callOpenRouter(system, prompt);
        if (provider === "gemini") return await this.callGemini(system, prompt);
        if (provider === "local") return this.localFallback();
      } catch (err) {
        lastError = err;
        console.warn(`[AI Provider ${provider} failed]`, err.message || err);
      }
    }

    return {
      provider: "local",
      model: "local",
      json: this.localFallback().json,
      raw: lastError ? String(lastError.message || lastError) : "All AI providers failed.",
    };
  }

  async callGroq(system, prompt) {
    const key = this.nextKey("groq");
    if (!key) throw new Error("No Groq API key configured");

    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) throw new Error(`Groq ${response.status}: ${await response.text()}`);

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    return {
      provider: "groq",
      model,
      raw,
      json: safeJsonParse(raw) || {},
    };
  }

  async callOpenRouter(system, prompt) {
    const key = this.nextKey("openrouter");
    if (!key) throw new Error("No OpenRouter API key configured");

    const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.DASHBOARD_PUBLIC_URL || "https://legendary-bot.local",
        "X-Title": "Legendary Bot",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${prompt}\n\nReturn JSON only.` },
        ],
      }),
    });

    if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    return {
      provider: "openrouter",
      model,
      raw,
      json: safeJsonParse(raw) || {},
    };
  }

  async callGemini(system, prompt) {
    const key = this.nextKey("gemini");
    if (!key) throw new Error("No Gemini API key configured");

    const model = process.env.GEMINI_MODEL || process.env.AI_INTEGRATIONS_GEMINI_MODEL || "gemini-1.5-flash";
    const ai = new GoogleGenAI({ apiKey: key });

    const result = await ai.models.generateContent({
      model,
      contents: `${system}\n\n${prompt}\n\nReturn JSON only.`,
      config: {
        temperature: 0.2,
      },
    });

    const raw = result.text || "";
    return {
      provider: "gemini",
      model,
      raw,
      json: safeJsonParse(raw) || {},
    };
  }

  localFallback() {
    return {
      provider: "local",
      model: "local",
      raw: "Local fallback used.",
      json: {
        score: 75,
        maturity: 7,
        trust: 7,
        activity: 7,
        experience: 6,
        risk: 3,
        recommendation: "review",
        summary: "AI provider was unavailable, so the bot used local scoring and recommends staff review.",
        flags: ["ai_provider_unavailable"],
      },
    };
  }
}

module.exports = new AIProviderManager();
