const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

let changelog = [];
try {
  changelog = require("../config/changelog");
} catch {
  changelog = require("./changelogData");
}

function getEntries() {
  return Array.isArray(changelog) ? changelog : [];
}

function buildChangelogEmbed(page = 0) {
  const entries = getEntries();
  const safePage = Math.max(0, Math.min(page, Math.max(entries.length - 1, 0)));
  const entry = entries[safePage];

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("📝 Legendary Bot Changelog")
    .setTimestamp();

  if (!entry) {
    return embed
      .setDescription("No changelog entries have been added yet.")
      .setFooter({ text: "Page 0/0" });
  }

  embed
    .setDescription(`**${entry.version || "Unknown"} — ${entry.title || "Update"}**${entry.date ? `\n📅 ${entry.date}` : ""}`)
    .setFooter({ text: `Page ${safePage + 1}/${entries.length} • Use the buttons below` });

  const changes = Array.isArray(entry.changes) ? entry.changes : [];
  embed.addFields({
    name: "Changes",
    value: changes.length
      ? changes.slice(0, 12).map((change) => `• ${change}`).join("\n").slice(0, 1024)
      : "No details added for this version.",
  });

  if (changes.length > 12) {
    embed.addFields({
      name: "More",
      value: `+${changes.length - 12} more changes are saved in this release.`,
    });
  }

  return embed;
}

function buildButtons(page = 0) {
  const total = getEntries().length;
  const safePage = Math.max(0, Math.min(page, Math.max(total - 1, 0)));

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("changelog_first")
        .setLabel("First")
        .setEmoji("⏮️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId("changelog_prev")
        .setLabel("Previous")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId("changelog_next")
        .setLabel("Next")
        .setEmoji("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= total - 1),
      new ButtonBuilder()
        .setCustomId("changelog_latest")
        .setLabel("Latest")
        .setEmoji("🆕")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId("changelog_close")
        .setLabel("Close")
        .setEmoji("✖️")
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

async function startChangelogSession({ send, userId, sourceMessage = null, ephemeral = false }) {
  let page = 0;
  const payload = {
    embeds: [buildChangelogEmbed(page)],
    components: buildButtons(page),
  };

  const response = await send(payload);

  const message =
    typeof response?.fetch === "function"
      ? await response.fetch().catch(() => null)
      : response;

  if (!message || typeof message.createMessageComponentCollector !== "function") {
    return response;
  }

  const collector = message.createMessageComponentCollector({
    time: 120000,
  });

  collector.on("collect", async (interaction) => {
    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: "❌ This changelog menu is not yours.",
        ephemeral: true,
      }).catch(() => null);
    }

    const total = getEntries().length;

    if (interaction.customId === "changelog_close") {
      collector.stop("closed");
      if (ephemeral) {
        return interaction.update({
          embeds: [buildChangelogEmbed(page)],
          components: [],
          content: "✅ Changelog menu closed.",
        }).catch(() => null);
      }

      await interaction.update({ components: [] }).catch(() => null);
      await message.delete().catch(() => null);
      if (sourceMessage) await sourceMessage.delete().catch(() => null);
      return null;
    }

    if (interaction.customId === "changelog_first") page = 0;
    if (interaction.customId === "changelog_prev") page = Math.max(0, page - 1);
    if (interaction.customId === "changelog_next") page = Math.min(total - 1, page + 1);
    if (interaction.customId === "changelog_latest") page = 0;

    return interaction.update({
      embeds: [buildChangelogEmbed(page)],
      components: buildButtons(page),
    }).catch(() => null);
  });

  collector.on("end", async () => {
    if (ephemeral) return;
    await message.edit({ components: [] }).catch(() => null);
  });

  return response;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("changelog")
    .setDescription("Show the latest Legendary Bot changelog"),

  accessLevel: "public",
  description: "Show the latest Legendary Bot updates with buttons.",
  usage: "$changelog",

  async execute(interaction) {
    return startChangelogSession({
      userId: interaction.user.id,
      ephemeral: true,
      send: (payload) => interaction.reply({ ...payload, ephemeral: true, fetchReply: true }),
    });
  },

  async executePrefix(message) {
    const sent = await startChangelogSession({
      userId: message.author.id,
      sourceMessage: message,
      ephemeral: false,
      send: (payload) => message.reply({
        ...payload,
        allowedMentions: { repliedUser: false },
      }),
    });

    // Prefix commands cannot be truly ephemeral in Discord. This keeps the menu private-ish:
    // only the command runner can use buttons, and it auto-cleans after two minutes.
    setTimeout(async () => {
      await sent?.delete?.().catch(() => null);
      await message.delete?.().catch(() => null);
    }, 120000);

    return sent;
  },
};
