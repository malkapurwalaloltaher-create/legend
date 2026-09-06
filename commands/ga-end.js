const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const GiveawayRun = require("../models/GiveawayRun");
const { endGiveawayRandom, logToChannel } = require("../utils/runtime");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxend")
    .setDescription("End a running giveaway early")
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

    await endGiveawayRandom(client, run._id);
    await logToChannel(client, run, `⏹️ Giveaway ended early by <@${interaction.user.id}> for **${run.prize}**.`);

    await interaction.reply({
      content: "✅ Giveaway ended successfully.",
      ephemeral: true
    });
  }
};
