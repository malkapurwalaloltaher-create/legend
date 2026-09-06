const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

async function fetchMeme() {
  const res = await fetch("https://meme-api.com/gimme");
  if (!res.ok) throw new Error("Meme API failed");
  const data = await res.json();

  if (data.nsfw || !data.url) throw new Error("Invalid meme");

  return new EmbedBuilder()
    .setTitle(data.title.slice(0, 256))
    .setURL(data.postLink)
    .setImage(data.url)
    .setColor(0xff4500)
    .setFooter({ text: `👍 ${data.ups.toLocaleString()}  •  r/${data.subreddit}` });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("meme")
    .setDescription("Get a random meme"),

  async execute(interaction) {
    await interaction.deferReply();
    try {
      await interaction.editReply({ embeds: [await fetchMeme()] });
    } catch {
      await interaction.editReply("❌ Couldn't fetch a meme right now. Try again later.");
    }
  },

  async executePrefix(message) {
    const reply = await message.reply("Fetching a meme...");
    try {
      await reply.edit({ content: "", embeds: [await fetchMeme()] });
    } catch {
      await reply.edit("❌ Couldn't fetch a meme right now. Try again later.");
    }
  },
};
