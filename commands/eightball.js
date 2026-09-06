const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const RESPONSES = [
  { text: "It is certain.", emoji: "✅", color: 0x00ff00 },
  { text: "It is decidedly so.", emoji: "✅", color: 0x00ff00 },
  { text: "Without a doubt.", emoji: "✅", color: 0x00ff00 },
  { text: "Yes, definitely.", emoji: "✅", color: 0x00ff00 },
  { text: "You may rely on it.", emoji: "✅", color: 0x00ff00 },
  { text: "As I see it, yes.", emoji: "✅", color: 0x00ff00 },
  { text: "Most likely.", emoji: "✅", color: 0x00ff00 },
  { text: "Outlook good.", emoji: "✅", color: 0x00ff00 },
  { text: "Yes.", emoji: "✅", color: 0x00ff00 },
  { text: "Signs point to yes.", emoji: "✅", color: 0x00ff00 },
  { text: "Reply hazy, try again.", emoji: "🔮", color: 0xffa500 },
  { text: "Ask again later.", emoji: "🔮", color: 0xffa500 },
  { text: "Better not tell you now.", emoji: "🔮", color: 0xffa500 },
  { text: "Cannot predict now.", emoji: "🔮", color: 0xffa500 },
  { text: "Concentrate and ask again.", emoji: "🔮", color: 0xffa500 },
  { text: "Don't count on it.", emoji: "❌", color: 0xff0000 },
  { text: "My reply is no.", emoji: "❌", color: 0xff0000 },
  { text: "My sources say no.", emoji: "❌", color: 0xff0000 },
  { text: "Outlook not so good.", emoji: "❌", color: 0xff0000 },
  { text: "Very doubtful.", emoji: "❌", color: 0xff0000 },
];

function buildEmbed(question) {
  const r = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
  return new EmbedBuilder()
    .setTitle("🎱 Magic 8-Ball")
    .setColor(r.color)
    .addFields(
      { name: "❓ Question", value: question },
      { name: `${r.emoji} Answer`, value: r.text },
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("eightball")
    .setDescription("Ask the magic 8-ball a yes/no question")
    .addStringOption((opt) =>
      opt.setName("question").setDescription("Your yes/no question").setRequired(true)
    ),

  async execute(interaction) {
    const question = interaction.options.getString("question");
    await interaction.reply({ embeds: [buildEmbed(question)] });
  },

  async executePrefix(message, args) {
    const question = args.join(" ");
    if (!question) return message.reply("❌ Ask a question! Usage: `$8ball Will it rain today?`");
    await message.reply({ embeds: [buildEmbed(question)] });
  },
};
