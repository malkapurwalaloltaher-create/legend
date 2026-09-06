const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

async function fetchDefinition(word) {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!res.ok) throw new Error("Not found");
  const data = await res.json();
  const entry = data[0];
  const phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || "";

  const embed = new EmbedBuilder()
    .setTitle(`📖 ${entry.word}${phonetic ? `  •  ${phonetic}` : ""}`)
    .setColor(0x3498db);

  for (const meaning of entry.meanings.slice(0, 3)) {
    const defs = meaning.definitions
      .slice(0, 2)
      .map((d, i) => `**${i + 1}.** ${d.definition}${d.example ? `\n*"${d.example}"*` : ""}`)
      .join("\n");
    embed.addFields({ name: `*${meaning.partOfSpeech}*`, value: defs });
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("define")
    .setDescription("Look up the definition of a word")
    .addStringOption((opt) =>
      opt.setName("word").setDescription("The word to define").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const word = interaction.options.getString("word");
    try {
      await interaction.editReply({ embeds: [await fetchDefinition(word)] });
    } catch {
      await interaction.editReply(`❌ No definition found for **${word}**.`);
    }
  },

  async executePrefix(message, args) {
    const word = args[0];
    if (!word) return message.reply("❌ Please provide a word. Usage: `$define serendipity`");
    const reply = await message.reply("🔍 Looking up...");
    try {
      await reply.edit({ content: "", embeds: [await fetchDefinition(word)] });
    } catch {
      await reply.edit(`❌ No definition found for **${word}**.`);
    }
  },
};
