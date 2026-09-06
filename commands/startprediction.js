const {
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");
const predictionManager = require("../managers/predictionManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("startprediction")
    .setDescription("Start a prediction with fake points")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel for the prediction")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("question").setDescription("Prediction question").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("option1").setDescription("First option").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("option2").setDescription("Second option").setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "❌ Admin only.", ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel");
    const question = interaction.options.getString("question");
    const option1 = interaction.options.getString("option1");
    const option2 = interaction.options.getString("option2");

    const preview = {
      question,
      options: [option1, option2],
      votes: {},
    };

    const msg = await channel.send({
      embeds: [predictionManager.buildPredictionEmbed(preview)],
      components: predictionManager.buildPredictionButtons(true),
    });

    const started = await predictionManager.startPrediction(
      interaction.guildId,
      channel.id,
      msg.id,
      question,
      option1,
      option2
    );

    if (!started.ok) {
      await msg.delete().catch(() => {});
      return interaction.reply({ content: `❌ ${started.reason}`, ephemeral: true });
    }

    await interaction.reply({ content: `✅ Prediction started in ${channel}`, ephemeral: true });
  },

  async executePrefix(message) {
    await message.reply("Use the slash command: /startprediction");
  },
};
