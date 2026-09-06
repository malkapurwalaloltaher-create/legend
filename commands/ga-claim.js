const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const GiveawayRun = require("../models/GiveawayRun");
const { logToChannel } = require("../utils/runtime");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxclaim")
    .setDescription("Mark a giveaway winner as claimed")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName("message_id").setDescription("Announcement message ID").setRequired(true)),

  async execute(interaction, client) {
    if (!(await ensureAdmin(interaction))) return;

    const messageId = interaction.options.getString("message_id");

    const run = await GiveawayRun.findOne({
      guildId: interaction.guild.id,
      messageId,
      status: "ended"
    });

    if (!run) {
      return interaction.reply({
        content: "❌ No ended giveaway found with that message ID.",
        ephemeral: true
      });
    }

    if (run.winnerClaimed) {
      return interaction.reply({
        content: "❌ This giveaway is already marked as claimed.",
        ephemeral: true
      });
    }

    run.winnerClaimed = true;
    await run.save();

    await logToChannel(client, run, `✅ Winner marked as claimed by <@${interaction.user.id}> for **${run.prize}**.`);

    await interaction.reply({
      content: "✅ Winner marked as claimed.",
      ephemeral: true
    });
  }
};
