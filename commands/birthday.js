const {
  SlashCommandBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const { hasPermission } = require("../utils");

const DashboardBirthday = require("../models/DashboardBirthday");
const DashboardEventCenterConfig = require("../models/DashboardEventCenterConfig");

function clean(value, max = 1200) {
  return String(value || "").trim().slice(0, max);
}

function parseBirthdayDate(value) {
  const text = clean(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildBirthdaySetModal({ channelId, targetUserId, announceInServer, dmUser, requesterId }) {
  return new ModalBuilder()
    .setCustomId(`birthday_set_modal:${channelId || "none"}:${targetUserId}:${announceInServer ? "1" : "0"}:${dmUser ? "1" : "0"}:${requesterId}`)
    .setTitle("Set Birthday")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("display_name")
          .setLabel("Display name")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Example: Xavier")
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("birthday_date")
          .setLabel("Birthday date (YYYY-MM-DD)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("2026-07-09")
          .setRequired(true)
          .setMaxLength(10)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("birthday_message")
          .setLabel("Custom message (optional)")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Leave empty for the default/AI-style birthday message. Use {user} or {name}.")
          .setRequired(false)
          .setMaxLength(1200)
      )
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("Birthday announcement tools.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set")
        .setDescription("Set a birthday with a private form.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("Birthday user. Leave empty to set your own birthday.")
            .setRequired(false)
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Birthday announcement channel. Leave empty to use dashboard default.")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName("server_announce")
            .setDescription("Post birthday announcement in the server channel? Default: yes.")
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName("dm_user")
            .setDescription("DM the birthday user too? Default: yes.")
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand !== "set") return;

    const targetUser = interaction.options.getUser("user") || interaction.user;
    const channel = interaction.options.getChannel("channel");
    const announceInServer = interaction.options.getBoolean("server_announce") ?? true;
    const dmUser = interaction.options.getBoolean("dm_user") ?? true;

    if (targetUser.id !== interaction.user.id && !hasPermission(interaction.member)) {
      return interaction.reply({ content: "❌ Staff/Admin only can set another user's birthday.", ephemeral: true });
    }

    if (channel && !channel.isTextBased()) {
      return interaction.reply({ content: "❌ Please choose a valid text channel.", ephemeral: true });
    }

    return interaction.showModal(
      buildBirthdaySetModal({
        channelId: channel?.id || "",
        targetUserId: targetUser.id,
        announceInServer,
        dmUser,
        requesterId: interaction.user.id,
      })
    );
  },

  async handleModalSubmit(interaction) {
    if (!interaction.customId.startsWith("birthday_set_modal:")) return false;

    const parts = interaction.customId.split(":");
    const channelId = parts[1] === "none" ? "" : parts[1];
    const targetUserId = parts[2];
    const announceInServer = parts[3] !== "0";
    const dmUser = parts[4] !== "0";
    const requesterId = parts[5];

    if (requesterId && requesterId !== interaction.user.id) {
      await interaction.reply({ content: "❌ This birthday form belongs to another user.", ephemeral: true });
      return true;
    }

    if (!interaction.guild) {
      await interaction.reply({ content: "❌ This can only be used in a server.", ephemeral: true });
      return true;
    }

    if (targetUserId !== interaction.user.id && !hasPermission(interaction.member)) {
      await interaction.reply({ content: "❌ Staff/Admin only can set another user's birthday.", ephemeral: true });
      return true;
    }

    const displayName = clean(interaction.fields.getTextInputValue("display_name"), 80);
    const birthdayDate = parseBirthdayDate(interaction.fields.getTextInputValue("birthday_date"));
    const customMessage = clean(interaction.fields.getTextInputValue("birthday_message"), 1200);

    if (!displayName || !birthdayDate) {
      await interaction.reply({ content: "❌ Invalid birthday date. Use `YYYY-MM-DD`, for example `2026-07-09`.", ephemeral: true });
      return true;
    }

    await DashboardEventCenterConfig.findOneAndUpdate(
      { guildId: interaction.guildId },
      { $setOnInsert: { guildId: interaction.guildId, enabled: true, birthdayAnnouncementsEnabled: true, timezone: "Asia/Dubai" } },
      { upsert: true, new: true }
    );

    await DashboardBirthday.findOneAndUpdate(
      { guildId: interaction.guildId, userId: targetUserId },
      {
        $set: {
          guildId: interaction.guildId,
          userId: targetUserId,
          displayName,
          month: birthdayDate.getMonth() + 1,
          day: birthdayDate.getDate(),
          channelId,
          customMessage,
          aiMessageEnabled: !customMessage,
          announceInServer,
          dmUser,
          createdBy: interaction.user.tag || interaction.user.username,
          createdById: interaction.user.id,
        },
      },
      { upsert: true, new: true }
    );

    await interaction.reply({
      content: `✅ Birthday saved for **${displayName}** on **${birthdayDate.getDate()}/${birthdayDate.getMonth() + 1}**.\nServer announce: **${announceInServer ? "On" : "Off"}** • DM: **${dmUser ? "On" : "Off"}**`,
      ephemeral: true,
    });

    return true;
  },
};
