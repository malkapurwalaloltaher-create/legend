const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const CHOICES = ["rock", "paper", "scissors"];
const EMOJI = { rock: "🪨", paper: "📄", scissors: "✂️" };

function getResult(player, bot) {
  if (player === bot) return "tie";
  if (
    (player === "rock" && bot === "scissors") ||
    (player === "paper" && bot === "rock") ||
    (player === "scissors" && bot === "paper")
  )
    return "win";
  return "lose";
}

async function play(player, replyFn) {
  const bot = CHOICES[Math.floor(Math.random() * 3)];
  const result = getResult(player, bot);
  const colors = { win: 0x00ff00, lose: 0xff0000, tie: 0xffa500 };
  const messages = { win: "🎉 You win!", lose: "😢 You lost!", tie: "🤝 It's a tie!" };

  const embed = new EmbedBuilder()
    .setTitle("✂️ Rock Paper Scissors")
    .setColor(colors[result])
    .setDescription(
      `You: ${EMOJI[player]} **${player}**\nBot: ${EMOJI[bot]} **${bot}**\n\n${messages[result]}`
    );

  await replyFn({ embeds: [embed] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rps")
    .setDescription("Play rock paper scissors against the bot")
    .addStringOption((opt) =>
      opt
        .setName("choice")
        .setDescription("Your move")
        .setRequired(true)
        .addChoices(
          { name: "Rock 🪨", value: "rock" },
          { name: "Paper 📄", value: "paper" },
          { name: "Scissors ✂️", value: "scissors" }
        )
    ),

  async execute(interaction) {
    const choice = interaction.options.getString("choice");
    await play(choice, (opts) => interaction.reply(opts));
  },

  async executePrefix(message, args) {
    const choice = args[0]?.toLowerCase();
    if (!CHOICES.includes(choice))
      return message.reply("❌ Choose **rock**, **paper**, or **scissors**. Usage: `$rps rock`");
    await play(choice, (opts) => message.reply(opts));
  },
};
