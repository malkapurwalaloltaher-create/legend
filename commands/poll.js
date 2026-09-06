const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const NUMBER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

function buildEmbed(question, options, author) {
  const embed = new EmbedBuilder()
    .setTitle("📊 " + question)
    .setColor(0x5865f2)
    .setFooter({ text: `Poll by ${author.username}` })
    .setTimestamp();

  if (options.length > 0) {
    embed.setDescription(options.map((opt, i) => `${NUMBER_EMOJIS[i]} ${opt}`).join("\n"));
  } else {
    embed.setDescription("Vote with ✅ **(Yes)** or ❌ **(No)**");
  }
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a poll in the chat")
    .addStringOption((opt) =>
      opt.setName("question").setDescription("The poll question").setRequired(true)
    )
    .addStringOption((opt) => opt.setName("option1").setDescription("Option 1"))
    .addStringOption((opt) => opt.setName("option2").setDescription("Option 2"))
    .addStringOption((opt) => opt.setName("option3").setDescription("Option 3"))
    .addStringOption((opt) => opt.setName("option4").setDescription("Option 4"))
    .addStringOption((opt) => opt.setName("option5").setDescription("Option 5")),

  async execute(interaction) {
    const question = interaction.options.getString("question");
    const options = [1, 2, 3, 4, 5]
      .map((n) => interaction.options.getString(`option${n}`))
      .filter(Boolean);

    await interaction.reply({ embeds: [buildEmbed(question, options, interaction.user)] });
    const reply = await interaction.fetchReply();

    if (options.length === 0) {
      await reply.react("✅");
      await reply.react("❌");
    } else {
      for (let i = 0; i < options.length; i++) await reply.react(NUMBER_EMOJIS[i]);
    }
  },

  async executePrefix(message) {
    const args = message.content.match(/"([^"]+)"/g)?.map((s) => s.replace(/"/g, ""));
    if (!args || args.length === 0) {
      return message.reply(
        '❌ Usage: `$poll "Question?" "Option 1" "Option 2"` — wrap each part in quotes. Options are optional for yes/no polls.'
      );
    }

    const [question, ...options] = args;
    const sent = await message.reply({ embeds: [buildEmbed(question, options, message.author)] });

    if (options.length === 0) {
      await sent.react("✅");
      await sent.react("❌");
    } else {
      for (let i = 0; i < Math.min(options.length, 5); i++) await sent.react(NUMBER_EMOJIS[i]);
    }
  },
};
