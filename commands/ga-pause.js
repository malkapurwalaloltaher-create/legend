const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const GiveawayRun = require("../models/GiveawayRun");
const { pauseGiveawayLifecycle } = require("../utils/runtime");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxpause")
    .setDescription("Pause a running giveaway")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName("message_id").setDescription("Announcement message ID").setRequired(true)),

  async execute(interaction, client) {
    if (!(await ensureAdmin(interaction))) return;

    const messageId = interaction.options.getString("message_id");

    const run = await GiveawayRun.findOne({
      guildId: interaction.guild.id,
      messageId,
      status: "running"
    });

    if (!run) {
      return interaction.reply({
        content: "❌ No running giveaway found with that message ID.",
        ephemeral: true
      });
    }

    if (run.isPaused) {
      return interaction.reply({
        content: "❌ This giveaway is already paused.",
        ephemeral: true
      });
    }

    run.isPaused = true;
    run.pausedAt = Date.now();
    await run.save();

    await pauseGiveawayLifecycle(client, run);

    await interaction.reply({
      content: "✅ Giveaway paused.",
      ephemeral: true
    });
  }
};
