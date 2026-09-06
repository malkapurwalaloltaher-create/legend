/* eslint-disable no-console */
require("dotenv").config();

const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");

const DRY_RUN = process.argv.includes("--dry-run");
const OVERWRITE = process.argv.includes("--overwrite");

const MODEL_ROUTES = [
  // serverDb
  { model: "AiCache", collection: "aicaches", scope: "serverDb" },
  { model: "Confession", collection: "confessions", scope: "serverDb" },
  { model: "GuildPlan", collection: "guildplans", scope: "serverDb" },
  { model: "GuildModuleUnlock", collection: "guildmoduleunlocks", scope: "serverDb" },
  { model: "LoopConfig", collection: "loopconfigs", scope: "serverDb" },
  { model: "Prediction", collection: "predictions", scope: "serverDb" },
  { model: "ReactionRole", collection: "reactionroles", scope: "serverDb" },
  { model: "Reminder", collection: "reminders", scope: "serverDb" },
  { model: "ServerEvent", collection: "serverevents", scope: "serverDb" },
  { model: "ServerSettings", collection: "serversettings", scope: "serverDb" },
  { model: "Ticket", collection: "tickets", scope: "serverDb" },

  // logsDb
  { model: "DashboardActionLog", collection: "dashboardactionlogs", scope: "logsDb" },
  { model: "ModeratorNote", collection: "moderatornotes", scope: "logsDb" },
  { model: "ModLog", collection: "modlogs", scope: "logsDb" },
  { model: "Warning", collection: "warnings", scope: "logsDb" },

  // customerDb
  { model: "CustomerAccount", collection: "customeraccounts", scope: "customerDb" },

  // customerServerDb
  { model: "DashboardSupportConfig", collection: "dashboardsupportconfigs", scope: "customerServerDb" },
];

function uniqueRoutes(routes) {
  const seen = new Set();
  return routes.filter((route) => {
    const key = `${route.scope}:${route.collection}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function collectionExists(db, collectionName) {
  const matches = await db.listCollections({ name: collectionName }).toArray();
  return matches.length > 0;
}

async function copyCollection(sourceDb, targetDb, route) {
  const exists = await collectionExists(sourceDb, route.collection);

  if (!exists) {
    console.log(`⏭️  ${route.collection} not found in main DB. Skipping.`);
    return { copied: 0, skipped: true };
  }

  const sourceCollection = sourceDb.collection(route.collection);
  const targetCollection = targetDb.collection(route.collection);

  const sourceCount = await sourceCollection.countDocuments();
  const targetCount = await targetCollection.countDocuments().catch(() => 0);

  console.log(`\n📦 ${route.collection}`);
  console.log(`   model: ${route.model}`);
  console.log(`   target: ${route.scope}`);
  console.log(`   source docs: ${sourceCount}`);
  console.log(`   target docs: ${targetCount}`);

  if (sourceCount === 0) {
    console.log("   nothing to copy");
    return { copied: 0, skipped: true };
  }

  if (targetCount > 0 && !OVERWRITE) {
    console.log("   target already has data; skipped. Use --overwrite to replace.");
    return { copied: 0, skipped: true };
  }

  if (DRY_RUN) {
    console.log("   dry-run only; not copying.");
    return { copied: sourceCount, skipped: false, dryRun: true };
  }

  const docs = await sourceCollection.find({}).toArray();

  if (OVERWRITE && targetCount > 0) {
    await targetCollection.deleteMany({});
    console.log("   old target docs deleted.");
  }

  if (docs.length > 0) {
    await targetCollection.insertMany(docs, { ordered: false });
  }

  console.log(`   copied ${docs.length} docs ✅`);

  return { copied: docs.length, skipped: false };
}

async function main() {
  const mainUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mainUri) {
    throw new Error("Missing MONGODB_URI or MONGO_URI");
  }

  console.log("🚚 Legendary Bot Split DB Migration");
  console.log("==================================");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE COPY"}`);
  console.log(`Overwrite target collections: ${OVERWRITE ? "YES" : "NO"}`);
  console.log("==================================");

  const mainConnection = await mongoose.createConnection(mainUri).asPromise();
  const connections = connectAllMongoDatabases();

  await new Promise((resolve) => setTimeout(resolve, 3500));

  const sourceDb = mainConnection.db;

  let totalCopied = 0;
  let totalSkipped = 0;

  for (const route of uniqueRoutes(MODEL_ROUTES)) {
    const targetConnection = connections[route.scope];

    if (!targetConnection || !targetConnection.db) {
      console.log(`⚠️ ${route.collection}: target connection ${route.scope} is missing. Skipping.`);
      totalSkipped++;
      continue;
    }

    try {
      const result = await copyCollection(sourceDb, targetConnection.db, route);
      totalCopied += result.copied || 0;
      if (result.skipped) totalSkipped++;
    } catch (err) {
      console.error(`❌ Failed copying ${route.collection}:`, err.message || err);
      totalSkipped++;
    }
  }

  console.log("\n==================================");
  console.log(`Copied docs: ${totalCopied}`);
  console.log(`Skipped collections: ${totalSkipped}`);
  console.log("Migration finished.");

  await mainConnection.close();
  await mongoose.disconnect().catch(() => null);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
