const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const { ensureAdmin } = require("../utils/adminOnly");
const { parseDuration } = require("../utils/duration");
const { buildTemplatePreviewEmbed } = require("../utils/embeds");
const GiveawayTemplate = require("../models/GiveawayTemplate");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gxcreate")
    .setDescription("Create giveaway template")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // REQUIRED FIRST
    .addStringOption(opt =>
      opt.setName("token").setDescription("Unique token").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("prize").setDescription("Prize").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("duration").setDescription("Example: 24h").setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("winners").setDescription("Number of winners").setRequired(true)
    )
    .addChannelOption(opt =>
      opt.setName("channel").setDescription("Giveaway channel").setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName("staff_participation")
        .setDescription("Allow staff to join?")
        .addChoices(
          { name: "Yes", value: "yes" },
          { name: "No", value: "no" }
        )
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("announcement").setDescription("Saved announcement").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("winner_dm").setDescription("Winner DM").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("participant_dm").setDescription("Participant DM").setRequired(true)
    )

    // OPTIONAL AFTER
    .addRoleOption(opt =>
      opt.setName("required_role").setDescription("Optional required role").setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName("min_account_age_days").setDescription("Minimum account age in days").setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName("host_display").setDescription("Custom hosted by text").setRequired(false)
    ),

  async execute(interaction) {
    if (!(await ensureAdmin(interaction))) return;

    const token = interaction.options.getString("token");
    const prize = interaction.options.getString("prize");
    const durationInput = interaction.options.getString("duration");
    const winners = interaction.options.getInteger("winners");
    const channel = interaction.options.getChannel("channel");
    const requiredRole = interaction.options.getRole("required_role");
    const minAccountAgeDays = interaction.options.getInteger("min_account_age_days") ?? 3;
    const staffParticipation = interaction.options.getString("staff_participation") === "yes";
    const hostDisplay = interaction.options.getString("host_display") || "GiveX System";
    const announcement = interaction.options.getString("announcement");
    const winnerDM = interaction.options.getString("winner_dm");
    const participantDM = interaction.options.getString("participant_dm");

    let durationMs;
    try {
      durationMs = parseDuration(durationInput);
    } catch {
      return interaction.reply({
        content: "❌ Invalid duration.",
        ephemeral: true
      });
    }

    const exists = await GiveawayTemplate.findOne({
      guildId: interaction.guild.id,
      token
    });

    if (exists) {
      return interaction.reply({
        content: "❌ Token already exists.",
        ephemeral: true
      });
    }

    const embed = buildTemplatePreviewEmbed({
      token,
      prize,
      durationMs,
      winnerCount: winners,
      channelId: channel.id,
      requiredRoleId: requiredRole?.id || "",
      minAccountAgeDays,
      staffParticipation,
      hostDisplay,
      announcementMessage: announcement,
      winnerDmMessage: winnerDM,
      participantDmMessage: participantDM,
      createdBy: interaction.user.id
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gxsave_${token}`)
        .setLabel("Save")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`gxcancel_${token}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });

    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      time: 60000
    });

    collector.on("collect", async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({
          content: "❌ This preview is not for you.",
          ephemeral: true
        });
      }

      if (btn.customId === `gxcancel_${token}`) {
        return btn.update({
          content: "❌ Giveaway creation cancelled.",
          embeds: [],
          components: []
        });
      }

      if (btn.customId === `gxsave_${token}`) {
        await GiveawayTemplate.create({
          guildId: interaction.guild.id,
          token,
          prize,
          durationMs,
          winnerCount: winners,
          channelId: channel.id,
          announcementMessage: announcement,
          winnerDmMessage: winnerDM,
          participantDmMessage: participantDM,
          requiredRoleId: requiredRole?.id || "",
          minAccountAgeDays,
          staffParticipation,
          hostDisplay,
          createdBy: interaction.user.id
        });

        return btn.update({
          content: `✅ Giveaway template saved with token \`${token}\`.`,
          embeds: [],
          components: []
        });
      }
    });
  }
};
