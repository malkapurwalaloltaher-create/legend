const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

function legacy(name) {
  return require(`./${name}`);
}

const LEGACY_MAP = {
  ban: "ban",
  kick: "kick",
  unban: "unban",
  mute: "mute",
  unmute: "unmute",
  warn: "warn",
  warnings: "warnings",
  clearwarnings: "clearwarnings",
  purge: "purge",
  clear: "clear",
  purgebot: "purgebot",
  purgeuser: "purgeuser",
  lock: "lock",
  unlock: "unlock",
  slowmode: "slowmode",
  nickname: "nickname",
  cleannick: "cleannick",
  dehoist: "dehoist",
  vcban: "vcban",
  unvcban: "unvcban",
  hackban: "hackban",
  massban: "massban",
  masskick: "masskick",
  massmute: "massmute",
  massunmute: "massunmute",
  massdeafen: "massdeafen",
  massundeafen: "massundeafen",
  nuke: "nuke",
  strip: "strip",
};

function userOption(sub, description = "Member") {
  return sub.addUserOption((option) =>
    option.setName("user").setDescription(description).setRequired(true)
  );
}

function reasonOption(sub) {
  return sub.addStringOption((option) =>
    option.setName("reason").setDescription("Reason")
  );
}

function usersOption(sub) {
  return sub.addStringOption((option) =>
    option
      .setName("users")
      .setDescription("Mention users or paste IDs separated by spaces")
      .setRequired(true)
  );
}

/*
  IMPORTANT:
  Discord allows max 25 direct options on one slash command.
  Each subcommand counts as one option.
  The old /moderation command had 30 subcommands, so Discord.js crashed with:
  ExpectedConstraintError: Invalid Array length

  Fix:
  We keep ONE top-level command: /moderation
  Then we split actions into subcommand groups:
  /moderation member ban
  /moderation message purge
  /moderation channel lock
  /moderation voice vcban
  /moderation mass massban

  This keeps the bot under Discord's command limits.
*/

module.exports = {
  data: new SlashCommandBuilder()
    .setName("moderation")
    .setDescription("Moderation command center")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

    .addSubcommandGroup((group) =>
      group
        .setName("member")
        .setDescription("Member moderation tools")
        .addSubcommand((sub) =>
          reasonOption(userOption(sub.setName("ban").setDescription("Ban a member"), "Member to ban"))
        )
        .addSubcommand((sub) =>
          reasonOption(userOption(sub.setName("kick").setDescription("Kick a member"), "Member to kick"))
        )
        .addSubcommand((sub) =>
          reasonOption(
            sub
              .setName("unban")
              .setDescription("Unban a user by ID")
              .addStringOption((option) =>
                option.setName("userid").setDescription("User ID to unban").setRequired(true)
              )
          )
        )
        .addSubcommand((sub) =>
          reasonOption(
            userOption(sub.setName("mute").setDescription("Timeout a member"), "Member to timeout")
              .addStringOption((option) =>
                option.setName("duration").setDescription("Duration, example: 10m, 1h, 1d")
              )
          )
        )
        .addSubcommand((sub) =>
          userOption(sub.setName("unmute").setDescription("Remove timeout from a member"))
        )
        .addSubcommand((sub) =>
          userOption(sub.setName("warn").setDescription("Warn a member"), "Member to warn")
            .addStringOption((option) =>
              option.setName("reason").setDescription("Warning reason").setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          userOption(sub.setName("warnings").setDescription("View warnings for a member"))
        )
        .addSubcommand((sub) =>
          userOption(sub.setName("clearwarnings").setDescription("Clear warnings for a member"))
        )
        .addSubcommand((sub) =>
          userOption(sub.setName("nickname").setDescription("Change a member nickname"))
            .addStringOption((option) =>
              option.setName("name").setDescription("New nickname").setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          userOption(sub.setName("cleannick").setDescription("Clear a member nickname"))
        )
        .addSubcommand((sub) =>
          userOption(sub.setName("dehoist").setDescription("Remove hoisting characters from nickname"))
        )
        .addSubcommand((sub) =>
          reasonOption(
            sub
              .setName("hackban")
              .setDescription("Ban a user by ID")
              .addStringOption((option) =>
                option.setName("userid").setDescription("User ID").setRequired(true)
              )
          )
        )
        .addSubcommand((sub) =>
          userOption(sub.setName("strip").setDescription("Remove editable roles from a member"))
        )
    )

    .addSubcommandGroup((group) =>
      group
        .setName("message")
        .setDescription("Message cleanup tools")
        .addSubcommand((sub) =>
          sub
            .setName("purge")
            .setDescription("Delete messages in this channel")
            .addIntegerOption((option) =>
              option.setName("amount").setDescription("1-100").setMinValue(1).setMaxValue(100).setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("clear")
            .setDescription("Clear messages in this channel")
            .addIntegerOption((option) =>
              option.setName("amount").setDescription("1-100").setMinValue(1).setMaxValue(100).setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("purgebot")
            .setDescription("Delete bot messages")
            .addIntegerOption((option) =>
              option.setName("amount").setDescription("1-100").setMinValue(1).setMaxValue(100).setRequired(true)
            )
        )
        .addSubcommand((sub) =>
          userOption(
            sub.setName("purgeuser").setDescription("Delete messages from a user"),
            "User whose messages should be deleted"
          ).addIntegerOption((option) =>
            option.setName("amount").setDescription("1-100").setMinValue(1).setMaxValue(100).setRequired(true)
          )
        )
        .addSubcommand((sub) =>
          sub.setName("nuke").setDescription("Safely wipe recent messages in this channel")
        )
    )

    .addSubcommandGroup((group) =>
      group
        .setName("channel")
        .setDescription("Channel moderation tools")
        .addSubcommand((sub) => sub.setName("lock").setDescription("Lock this channel"))
        .addSubcommand((sub) => sub.setName("unlock").setDescription("Unlock this channel"))
        .addSubcommand((sub) =>
          sub
            .setName("slowmode")
            .setDescription("Set channel slowmode")
            .addIntegerOption((option) =>
              option
                .setName("seconds")
                .setDescription("Slowmode seconds")
                .setMinValue(0)
                .setMaxValue(21600)
                .setRequired(true)
            )
        )
    )

    .addSubcommandGroup((group) =>
      group
        .setName("voice")
        .setDescription("Voice moderation tools")
        .addSubcommand((sub) =>
          reasonOption(userOption(sub.setName("vcban").setDescription("Voice ban a member")))
        )
        .addSubcommand((sub) =>
          userOption(sub.setName("unvcban").setDescription("Remove voice ban from a member"))
        )
    )

    .addSubcommandGroup((group) =>
      group
        .setName("mass")
        .setDescription("Mass moderation tools")
        .addSubcommand((sub) =>
          usersOption(sub.setName("massban").setDescription("Ban multiple users by ID/mention"))
        )
        .addSubcommand((sub) =>
          usersOption(sub.setName("masskick").setDescription("Kick multiple users by ID/mention"))
        )
        .addSubcommand((sub) =>
          usersOption(sub.setName("massmute").setDescription("Timeout multiple users by ID/mention"))
        )
        .addSubcommand((sub) =>
          usersOption(sub.setName("massunmute").setDescription("Remove timeout from multiple users"))
        )
        .addSubcommand((sub) =>
          usersOption(sub.setName("massdeafen").setDescription("Deafen multiple users in voice"))
        )
        .addSubcommand((sub) =>
          usersOption(sub.setName("massundeafen").setDescription("Undeafen multiple users in voice"))
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const file = LEGACY_MAP[subcommand];

    if (!file) {
      return interaction.reply({ content: "❌ Unknown moderation action.", ephemeral: true });
    }

    const command = legacy(file);
    if (!command || typeof command.execute !== "function") {
      return interaction.reply({ content: "❌ This moderation action is not available yet.", ephemeral: true });
    }

    return command.execute(interaction);
  },
};
