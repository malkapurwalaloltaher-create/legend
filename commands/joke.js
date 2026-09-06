const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const DATA_FILE = path.join(DATA_DIR, "used-jokes.json");
const COOLDOWN_MS = 72 * 60 * 60 * 1000;

function loadUsedJokes() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch { return []; }
}

function saveUsedJokes(jokes) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(jokes));
}

function getRecentIds() {
  const cutoff = Date.now() - COOLDOWN_MS;
  const all = loadUsedJokes();
  const recent = all.filter((j) => j.ts > cutoff);
  if (recent.length !== all.length) saveUsedJokes(recent);
  return recent.map((j) => j.id);
}

async function getJoke() {
  const recentIds = getRecentIds();
  let joke;
  let attempts = 0;
  do {
    const res = await fetch("https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist,sexist,explicit");
    joke = await res.json();
    attempts++;
  } while (joke && !joke.error && recentIds.includes(joke.id) && attempts < 5);

  if (!joke || joke.error) throw new Error("Could not fetch a joke right now.");

  const used = loadUsedJokes();
  used.push({ id: joke.id, ts: Date.now() });
  saveUsedJokes(used);

  return joke;
}

function buildEmbed(joke) {
  const embed = new EmbedBuilder().setColor(0xffd700).setTitle("😂 Here's a joke!");
  if (joke.type === "twopart") {
    embed.setDescription(`**${joke.setup}**\n\n||${joke.delivery}||`);
    embed.setFooter({ text: "Tap the spoiler to reveal the punchline!" });
  } else {
    embed.setDescription(joke.joke);
  }
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("joke")
    .setDescription("Get a random joke — no repeats for 72 hours!"),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const joke = await getJoke();
      await interaction.editReply({ embeds: [buildEmbed(joke)] });
    } catch (error) {
      const message = "❌ Could not fetch a joke right now. Please try again later.";
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message, embeds: [] }).catch(() => null);
      else await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
    }
  },

  async executePrefix(message) {
    const reply = await message.reply("Fetching a joke...");
    try {
      const joke = await getJoke();
      await reply.edit({ content: "", embeds: [buildEmbed(joke)] });
    } catch (error) {
      await reply.edit({ content: "❌ Could not fetch a joke right now. Please try again later.", embeds: [] }).catch(() => null);
    }
  },
};
