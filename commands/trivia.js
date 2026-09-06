const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function decode(str) {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'");
}

async function fetchTrivia() {
  const res = await fetch("https://opentdb.com/api.php?amount=1&type=multiple");
  const data = await res.json();
  const q = data.results[0];

  const question = decode(q.question);
  const correct = decode(q.correct_answer);
  const all = [...q.incorrect_answers.map(decode), correct].sort(() => Math.random() - 0.5);
  const letters = ["🇦", "🇧", "🇨", "🇩"];
  const correctIdx = all.indexOf(correct);
  const options = all.map((opt, i) => `${letters[i]} ${opt}`).join("\n");
  const difficulty = q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1);

  return new EmbedBuilder()
    .setTitle("🧠 Trivia Time!")
    .setColor(0x9b59b6)
    .addFields(
      { name: `📂 ${q.category}  •  ${difficulty}`, value: question },
      { name: "Options", value: options },
      { name: "✅ Answer", value: `||${letters[correctIdx]} ${correct}||` },
    )
    .setFooter({ text: "Tap the spoiler to reveal the answer!" });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("trivia")
    .setDescription("Get a random trivia question"),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      await interaction.editReply({ embeds: [await fetchTrivia()] });
    } catch {
      await interaction.editReply("❌ Couldn't fetch a trivia question right now.");
    }
  },

  async executePrefix(message) {
    const reply = await message.reply("Fetching a trivia question...");
    try {
      await reply.edit({ content: "", embeds: [await fetchTrivia()] });
    } catch {
      await reply.edit("❌ Couldn't fetch a trivia question right now.");
    }
  },
};
