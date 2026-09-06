const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { getAccessProfile } = require("../utils/roleAccess");

const PREFIX = "$";

const COMMAND_GROUPS = [
  {
    title: "🔥 Legendary Bot Help Menu — 🎉 Fun Commands",
    level: "public",
    sectionLabel: "🌎 Public member section",
    description: "Fun and entertainment commands that normal members can use safely in the server.",
    commands: [
      "`$meme` / `/meme`",
      "`$trivia` / `/trivia`",
      "`$choose option1 option2` / `/choose`",
      "`$reverse [text]` / `/reverse`",
      "`$roast @user` / `/roast`",
    ],
  },
  {
    title: "🔥 Legendary Bot Help Menu — 👤 Info Commands",
    level: "public",
    sectionLabel: "🌎 Public member section",
    description: "Helpful user and server information commands for checking profiles, avatars, and server details.",
    commands: [
      "`$userinfo @user` / `/userinfo`",
      "`$avatar @user` / `/avatar`",
      "`$serverinfo` / `/serverinfo`",
      "`$rank` / `/rank`",
      "`$leaderboard` / `/leaderboard`",
      "`$version` / `/version`",
      "`$changelog` / `/changelog`",
    ],
  },
  {
    title: "🔥 Legendary Bot Help Menu — 📊 Utility Commands",
    level: "public",
    sectionLabel: "🌎 Public member section",
    description: "Useful community commands for polls, reminders, definitions, weather, and quick tools.",
    commands: [
      "`$poll` / `/poll`",
      "`$remind` / `/remind`",
      "`$afk [reason]` / `/afk`",
      "`$weather` / `/weather`",
      "`$define word` / `/define`",
      "`$roll` / `/roll`",
      "`$coinflip` / `/coinflip`",
      "`$8ball question` / `/eightball`",
      "`$quote` / `/quote`",
      "`$rps` / `/rps`",
    ],
  },
  {
    title: "🔥 Legendary Bot Help Menu — 📌 Staff Commands",
    level: "staff",
    sectionLabel: "📌 Staff member section",
    description: "Staff tools shown only when you have a staff role, mod role, or staff-level permissions.",
    commands: [
      "`$note @user text` / `/note`",
      "`$notes @user` / `/notes`",
      "`$clearnotes @user` / `/clearnotes`",
      "`$history @user` / `/history`",
      "`$dm @user message` / `/dm`",
      "`$say message` / `/say`",
      "`$announce` / `/announce`",
      "`$staffroles`",
      "`$modroles`",
    ],
  },
  {
    title: "🔥 Legendary Bot Help Menu — 🛡️ Moderation",
    level: "mod",
    sectionLabel: "🛡️ Moderator section",
    description: "Moderation tools shown only when you have a mod role or the required moderation permissions.",
    commands: [
      "`$warn @user reason` / `/warn`",
      "`$warnings @user` / `/warnings`",
      "`$clearwarnings @user` / `/clearwarnings`",
      "`$mute @user duration reason` / `/mute`",
      "`$unmute @user` / `/unmute`",
      "`$kick @user reason` / `/kick`",
      "`$ban @user reason` / `/ban`",
      "`$unban userId` / `/unban`",
      "`$purge amount` / `/purge`",
      "`$purgebot amount` / `/purgebot`",
      "`$purgeuser @user amount` / `/purgeuser`",
      "`$lock` / `/lock`",
      "`$unlock` / `/unlock`",
      "`$slowmode seconds` / `/slowmode`",
    ],
  },
  {
    title: "🔥 Legendary Bot Help Menu — 🧰 Advanced Moderation",
    level: "mod",
    sectionLabel: "🛡️ Moderator section",
    description: "Advanced moderation and cleanup tools for trusted moderation members.",
    commands: [
      "`$nickname @user name` / `/nickname`",
      "`$cleannick @user` / `/cleannick`",
      "`$dehoist` / `/dehoist`",
      "`$strip @user` / `/strip`",
      "`$hackban userId` / `/hackban`",
      "`$vcban @user` / `/vcban`",
      "`$unvcban @user` / `/unvcban`",
      "`$massban` / `/massban`",
      "`$masskick` / `/masskick`",
      "`$massmute` / `/massmute`",
      "`$massunmute` / `/massunmute`",
      "`$massdeafen` / `/massdeafen`",
      "`$massundeafen` / `/massundeafen`",
      "`$nuke` / `/nuke`",
    ],
  },
  {
    title: "🔥 Legendary Bot Help Menu — ⚙️ Server Setup",
    level: "admin",
    sectionLabel: "👑 Admin/Manager section",
    description: "Admin and manager setup commands for configuring Legendary Bot systems.",
    commands: [
      "`$setlog #channel` / `/setlog`",
      "`$setwelcome` / `/setwelcome`",
      "`$setverify` / `/setverify`",
      "`$setconfesschannel` / `/setconfesschannel`",
      "`$setroastchannel` / `/setroastchannel`",
      "`$setfootballchannel` / `/setfootballchannel`",
      "`$setcricketchannel` / `/setcricketchannel`",
      "`$setyap` / `/setyap`",
      "`$setrumors` / `/setrumors`",
      "`$setautomessage` / `/setautomessage`",
      "`$stopautomessage` / `/stopautomessage`",
      "`$stopyap` / `/stopyap`",
      "`$stoprumors` / `/stoprumors`",
      "`$createinvite` / `/createinvite`",
      "`$clearinvites` / `/clearinvites`",
      "`$setcolor` / `/setcolor`",
      "`$mentionable` / `/mentionable`",
      "`$roledump` / `/roledump`",
    ],
  },
  {
    title: "🔥 Legendary Bot Help Menu — 🔐 Security / AutoMod",
    level: "admin",
    sectionLabel: "👑 Admin/Manager section",
    description: "Admin-only security, automod, and role access setup commands.",
    commands: [
      "`$automod` / `/automod`",
      "`$antilink` / `/antilink`",
      "`$antispam` / `/antispam`",
      "`$antiraid` / `/antiraid`",
      "`$setstaffrole @role1, @role2`",
      "`$removestaffrole @role1, @role2`",
      "`$setmodrole @role1, @role2`",
      "`$removemodrole @role1, @role2`",
    ],
  },
  {
    title: "🔥 Legendary Bot Help Menu — 🏟️ Sports",
    level: "staff",
    sectionLabel: "📌 Staff member section",
    description: "Sports live score and auto update commands.",
    commands: [
      "`$footballlive` / `/footballlive`",
      "`$footballauto` / `/footballauto`",
      "`$unlockfootballchannel` / `/unlockfootballchannel`",
      "`$cricketlive` / `/cricketlive`",
      "`$cricketauto` / `/cricketauto`",
      "`$unlockcricketchannel` / `/unlockcricketchannel`",
    ],
  },
];

function canSee(group, profile) {
  if (group.level === "public") return true;
  if (group.level === "staff") return profile.staff;
  if (group.level === "mod") return profile.mod;
  if (group.level === "admin") return profile.isAdmin || profile.isManager;
  return true;
}

function clampPage(page, total) {
  const n = Number(page || 0);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(total - 1, n));
}

async function getVisibleGroups(member) {
  const profile = await getAccessProfile(member);
  const groups = COMMAND_GROUPS.filter((group) => canSee(group, profile));

  return {
    profile,
    groups: groups.length ? groups : COMMAND_GROUPS.filter((group) => group.level === "public"),
  };
}

function buildHelpEmbed({ user, groups, page }) {
  const total = Math.max(groups.length, 1);
  const safePage = clampPage(page, total);
  const group = groups[safePage] || COMMAND_GROUPS[0];

  const description = [
    `**${group.description}**`,
    "",
    group.commands.join("\n"),
    "",
    `📖 **Page ${safePage + 1}/${total}**`,
    `💡 **Prefix:** \`${PREFIX}\``,
    `🌎 **${group.sectionLabel.replace(/^🌎\s*/, "").replace(/^📌\s*/, "").replace(/^🛡️\s*/, "").replace(/^👑\s*/, "")}**`,
  ].join("\n");

  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(group.title)
    .setDescription(description)
    .setFooter({
      text: `Requested by ${user?.tag || user?.username || "Unknown"} • Private help menu`,
    })
    .setTimestamp();
}

function buildHelpButtons({ userId, page, total }) {
  const safePage = clampPage(page, total);

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`help_prev_${userId}_${safePage}`)
        .setLabel("Previous")
        .setEmoji("⬅️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),

      new ButtonBuilder()
        .setCustomId(`help_home_${userId}_${safePage}`)
        .setLabel("Home")
        .setEmoji("🏠")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(safePage === 0),

      new ButtonBuilder()
        .setCustomId(`help_next_${userId}_${safePage}`)
        .setLabel("Next")
        .setEmoji("➡️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= total - 1)
    ),
  ];
}

async function buildHelpMessagePayload({ member, user, page = 0 }) {
  const { groups } = await getVisibleGroups(member);
  const safePage = clampPage(page, groups.length);

  return {
    embeds: [buildHelpEmbed({ user, groups, page: safePage })],
    components: buildHelpButtons({
      userId: user.id,
      page: safePage,
      total: groups.length,
    }),
  };
}

async function sendTempChannelNotice(message, content) {
  const notice = await message.reply(content).catch(() => null);
  if (notice) {
    setTimeout(() => notice.delete().catch(() => null), 9000);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show the Legendary Bot help menu privately"),

  accessLevel: "public",
  description: "Private smart help menu with buttons.",
  usage: "$help",
  aliases: ["commands", "h"],

  async execute(interaction) {
    const payload = await buildHelpMessagePayload({
      member: interaction.member,
      user: interaction.user,
      page: 0,
    });

    return interaction.reply({
      ...payload,
      ephemeral: true,
    });
  },

  async executePrefix(message) {
    const payload = await buildHelpMessagePayload({
      member: message.member,
      user: message.author,
      page: 0,
    });

    try {
      await message.author.send(payload);
      await sendTempChannelNotice(message, "✅ I sent the **Legendary Bot Help Menu** to your DMs.");
    } catch {
      await sendTempChannelNotice(
        message,
        "❌ I couldn’t DM you. Please open your DMs and run `$help` again."
      );
    }
  },

  async handleButton(interaction) {
    if (!interaction.customId.startsWith("help_")) return false;

    const parts = interaction.customId.split("_");
    const action = parts[1];
    const ownerId = parts[2];
    const currentPage = Number(parts[3] || 0);

    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: "❌ This help menu belongs to someone else. Run `/help` or `$help` to open your own.",
        ephemeral: true,
      });
      return true;
    }

    let member = interaction.member;
    if (!member && interaction.guild) {
      member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    }

    const { groups } = await getVisibleGroups(member);

    let nextPage = currentPage;
    if (action === "prev") nextPage = currentPage - 1;
    if (action === "next") nextPage = currentPage + 1;
    if (action === "home") nextPage = 0;

    const payload = await buildHelpMessagePayload({
      member,
      user: interaction.user,
      page: clampPage(nextPage, groups.length),
    });

    await interaction.update(payload);
    return true;
  },
};

// AI Session Chat: mention the bot to wake AI, then use $stop to close the session.
