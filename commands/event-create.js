const {
  SlashCommandBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const { hasPermission } = require("../utils");

const DashboardEventItem = require("../models/DashboardEventItem");
const DashboardEventCenterConfig = require("../models/DashboardEventCenterConfig");

function clean(value, max = 1500) {
  return String(value || "").trim().slice(0, max);
}

function timezoneOffsetFromLabel(label) {
  const text = String(label || "").toLowerCase();
  if (text.includes("dubai") || text.includes("uae") || text.includes("asia/dubai")) return "+04:00";
  if (text.includes("india") || text.includes("kolkata") || text.includes("ist")) return "+05:30";
  const match = String(label || "").match(/([+-]\d{2}:?\d{2})/);
  if (match) {
    const raw = match[1].replace(/^(.[0-9]{2})([0-9]{2})$/, "$1:$2");
    return raw;
  }
  return "+00:00";
}

function parseDateTime(dateText, timeText, timezoneLabel) {
  const date = clean(dateText, 20);
  const time = clean(timeText, 12);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\d{2}:\d{2}$/.test(time)) return null;

  const offset = timezoneOffsetFromLabel(timezoneLabel);
  const parsed = new Date(`${date}T${time}:00${offset}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildEventModal(channelId, requesterId) {
  return new ModalBuilder()
    .setCustomId(`event_create_modal:${channelId}:${requesterId}`)
    .setTitle("Schedule Event Announcement")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("event_title")
          .setLabel("Event name")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Example: Birthday Party / Server Event")
          .setRequired(true)
          .setMaxLength(120)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("event_date")
          .setLabel("Date (YYYY-MM-DD)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("2026-07-09")
          .setRequired(true)
          .setMaxLength(10)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("event_time")
          .setLabel("Time (24-hour HH:mm)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("20:30")
          .setRequired(true)
          .setMaxLength(5)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("event_message")
          .setLabel("Custom announcement message")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("Write the exact message the bot should send.")
          .setRequired(true)
          .setMaxLength(1500)
      )
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event-create")
    .setDescription("Schedule a custom event announcement with a private form.")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel where the bot will send the announcement")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),
  accessLevel: "staff",

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: "❌ This command can only be used in a server.", ephemeral: true });
    }

    if (!hasPermission(interaction.member)) {
      return interaction.reply({ content: "❌ Staff/Admin only.", ephemeral: true });
    }

    const channel = interaction.options.getChannel("channel");
    if (!channel || !channel.isTextBased()) {
      return interaction.reply({ content: "❌ Please choose a valid text channel.", ephemeral: true });
    }

    return interaction.showModal(buildEventModal(channel.id, interaction.user.id));
  },

  async handleModalSubmit(interaction) {
    if (!interaction.customId.startsWith("event_create_modal:")) return false;

    const [, channelId, requesterId] = interaction.customId.split(":");
    if (requesterId && requesterId !== interaction.user.id) {
      await interaction.reply({ content: "❌ This form belongs to another user.", ephemeral: true });
      return true;
    }

    if (!interaction.guild || !hasPermission(interaction.member)) {
      await interaction.reply({ content: "❌ Staff/Admin only.", ephemeral: true });
      return true;
    }

    const title = clean(interaction.fields.getTextInputValue("event_title"), 120);
    const dateText = clean(interaction.fields.getTextInputValue("event_date"), 20);
    const timeText = clean(interaction.fields.getTextInputValue("event_time"), 20);
    const message = clean(interaction.fields.getTextInputValue("event_message"), 1500);

    const config = await DashboardEventCenterConfig.findOneAndUpdate(
      { guildId: interaction.guildId },
      { $setOnInsert: { guildId: interaction.guildId, enabled: true, timezone: "Asia/Dubai" } },
      { upsert: true, new: true }
    );

    const startsAt = parseDateTime(dateText, timeText, config.timezone || "Asia/Dubai");
    if (!title || !startsAt || !message) {
      await interaction.reply({
        content: "❌ Invalid form. Use date like `2026-07-09`, time like `20:30`, and include a message.",
        ephemeral: true,
      });
      return true;
    }

    const event = await DashboardEventItem.create({
      guildId: interaction.guildId,
      title,
      description: "Scheduled from /event-create command.",
      type: "custom",
      status: "scheduled",
      channelId,
      startsAt,
      reminderMinutes: 0,
      messageMode: "custom",
      customMessage: message,
      createdBy: interaction.user.tag || interaction.user.username,
      createdById: interaction.user.id,
    });

    await interaction.reply({
      content: `✅ Event scheduled!\n**${title}** will be sent in <#${channelId}> at <t:${Math.floor(startsAt.getTime() / 1000)}:F>.\nEvent ID: \`${event._id}\``,
      ephemeral: true,
    });

    return true;
  },
};
