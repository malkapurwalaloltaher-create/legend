const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const { parseDuration } = require("../utils/duration");
const GiveawayTemplate = require("../models/GiveawayTemplate");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxedit")
    .setDescription("Edit a saved giveaway template")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => opt.setName("token").setDescription("Token to edit").setRequired(true))
    .addStringOption(opt => opt.setName("prize").setDescription("New prize").setRequired(false))
    .addStringOption(opt => opt.setName("duration").setDescription("New duration").setRequired(false))
    .addIntegerOption(opt => opt.setName("winners").setDescription("New winner count").setRequired(false))
    .addChannelOption(opt => opt.setName("channel").setDescription("New channel").setRequired(false))
    .addRoleOption(opt => opt.setName("required_role").setDescription("New required role").setRequired(false))
    .addIntegerOption(opt => opt.setName("min_account_age_days").setDescription("New minimum account age in days").setRequired(false))
    .addStringOption(opt =>
      opt
        .setName("staff_participation")
        .setDescription("Allow staff to join?")
        .addChoices(
          { name: "Yes", value: "yes" },
          { name: "No", value: "no" }
        )
        .setRequired(false)
    )
    .addStringOption(opt => opt.setName("host_display").setDescription("Custom hosted by text").setRequired(false))
    .addStringOption(opt => opt.setName("announcement").setDescription("New announcement").setRequired(false))
    .addStringOption(opt => opt.setName("winner_dm").setDescription("New winner DM").setRequired(false))
    .addStringOption(opt => opt.setName("participant_dm").setDescription("New participant DM").setRequired(false)),

  async execute(interaction) {
    if (!(await ensureAdmin(interaction))) return;

    const token = interaction.options.getString("token");
    const prize = interaction.options.getString("prize");
    const durationInput = interaction.options.getString("duration");
    const winners = interaction.options.getInteger("winners");
    const channel = interaction.options.getChannel("channel");
    const requiredRole = interaction.options.getRole("required_role");
    const minAccountAgeDays = interaction.options.getInteger("min_account_age_days");
    const staffParticipationInput = interaction.options.getString("staff_participation");
    const hostDisplay = interaction.options.getString("host_display");
    const announcement = interaction.options.getString("announcement");
    const winnerDM = interaction.options.getString("winner_dm");
    const participantDM = interaction.options.getString("participant_dm");

    const template = await GiveawayTemplate.findOne({
      guildId: interaction.guild.id,
      token
    });

    if (!template) {
      return interaction.reply({
        content: "❌ No giveaway template found with that token.",
        ephemeral: true
      });
    }

    let changed = false;

    if (prize) {
      template.prize = prize;
      changed = true;
    }

    if (durationInput) {
      try {
        template.durationMs = parseDuration(durationInput);
        changed = true;
      } catch {
        return interaction.reply({
          content: "❌ Invalid duration.",
          ephemeral: true
        });
      }
    }

    if (winners) {
      template.winnerCount = winners;
      changed = true;
    }

    if (channel) {
      template.channelId = channel.id;
      changed = true;
    }

    if (requiredRole) {
      template.requiredRoleId = requiredRole.id;
      changed = true;
    }

    if (minAccountAgeDays !== null) {
      template.minAccountAgeDays = minAccountAgeDays;
      changed = true;
    }

    if (staffParticipationInput) {
      template.staffParticipation = staffParticipationInput === "yes";
      changed = true;
    }

    if (hostDisplay) {
      template.hostDisplay = hostDisplay;
      changed = true;
    }

    if (announcement) {
      template.announcementMessage = announcement;
      changed = true;
    }

    if (winnerDM) {
      template.winnerDmMessage = winnerDM;
      changed = true;
    }

    if (participantDM) {
      template.participantDmMessage = participantDM;
      changed = true;
    }

    if (!changed) {
      return interaction.reply({
        content: "❌ You did not provide anything to edit.",
        ephemeral: true
      });
    }

    await template.save();

    await interaction.reply({
      content: `✅ Giveaway template \`${token}\` updated successfully.`,
      ephemeral: true
    });
  }
};
