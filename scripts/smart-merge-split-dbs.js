/* eslint-disable no-console */
require("dotenv").config();

const mongoose = require("mongoose");
const { connectAllMongoDatabases } = require("../database/connections");

const DRY_RUN = process.argv.includes("--dry-run");

const COLLECTION_ROUTES = [
  // server DB dashboard/config collections
  { collection: "aicaches", scope: "serverDb" },
  { collection: "confessions", scope: "serverDb" },
  { collection: "dashboardautomessages", scope: "serverDb" },
  { collection: "dashboardconfessionstyles", scope: "serverDb" },
  { collection: "dashboardcustomcommands", scope: "serverDb" },
  { collection: "dashboardembedtemplates", scope: "serverDb" },
  { collection: "dashboardlevelusers", scope: "serverDb" },
  { collection: "dashboardlevelsconfigs", scope: "serverDb" },
  { collection: "dashboardloopcontents", scope: "serverDb" },
  { collection: "dashboardmoduleconfigs", scope: "serverDb" },
  { collection: "dashboardreactionrolepanels", scope: "serverDb" },
  { collection: "dashboardsportsconfigs", scope: "serverDb" },
  { collection: "dashboardstarboardconfigs", scope: "serverDb" },
  { collection: "dashboardticketconfigs", scope: "serverDb" },
  { collection: "dashboardwelcomegoodbyes", scope: "serverDb" },
  { collection: "guildmoduleunlocks", scope: "serverDb" },
  { collection: "guildplans", scope: "serverDb" },
  { collection: "loopconfigs", scope: "serverDb" },
  { collection: "moderationcases", scope: "serverDb" },
  { collection: "moderationconfigs", scope: "serverDb" },
  { collection: "moderationvcbans", scope: "serverDb" },

  // logs DB
  { collection: "dashboardactionlogs", scope: "logsDb" },
  { collection: "dashboardloginlogs", scope: "logsDb" },
  { collection: "moderationnotes", scope: "logsDb" },
  { collection: "moderationwarnings", scope: "logsDb" },

  // customer DB
  { collection: "customeraccounts", scope: "customerDb" },

  // customer server DB
  { collection: "dashboardsupportconfigs", scope: "customerServerDb" },
];

async function collectionExists(db, collectionName) {
  const matches = await db.listCollections({ name: collectionName }).toArray();
  return matches.length > 0;
}

async function smartMergeCollection(sourceDb, targetDb, route) {
  const exists = await collectionExists(sourceDb, route.collection);
  if (!exists) {
    console.log(`⏭️  ${route.collection}: not found in main DB`);
    return { inserted: 0, skipped: 0, missing: true };
  }

  const source = sourceDb.collection(route.collection);
  const target = targetDb.collection(route.collection);

  const sourceDocs = await source.find({}).toArray();
  const targetCount = await target.countDocuments().catch(() => 0);

  let inserted = 0;
  let skipped = 0;

  console.log(`\n📦 ${route.collection} → ${route.scope}`);
  console.log(`   source docs: ${sourceDocs.length}`);
  console.log(`   target docs before: ${targetCount}`);

  for (const doc of sourceDocs) {
    const existsInTarget = await target.findOne({ _id: doc._id });
    if (existsInTarget) {
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      await target.insertOne(doc);
    }

    inserted++;
  }

  console.log(`   ${DRY_RUN ? "would insert" : "inserted"}: ${inserted}`);
  console.log(`   skipped existing: ${skipped}`);

  return { inserted, skipped };
}

async function main() {
  const mainUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mainUri) throw new Error("Missing MONGODB_URI or MONGO_URI");

  console.log("🧠 Legendary Bot Smart Merge Migration");
  console.log("=====================================");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE SMART MERGE"}`);
  console.log("This copies only missing _id documents. It never deletes target data.");
  console.log("=====================================");

  const mainConnection = await mongoose.createConnection(mainUri).asPromise();
  const connections = connectAllMongoDatabases();
  await new Promise((resolve) => setTimeout(resolve, 3500));

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalMissingCollections = 0;

  for (const route of COLLECTION_ROUTES) {
    const targetConnection = connections[route.scope];
    if (!targetConnection || !targetConnection.db) {
      console.log(`⚠️ ${route.collection}: missing target connection ${route.scope}`);
      continue;
    }

    try {
      const result = await smartMergeCollection(mainConnection.db, targetConnection.db, route);
      totalInserted += result.inserted || 0;
      totalSkipped += result.skipped || 0;
      if (result.missing) totalMissingCollections++;
    } catch (err) {
      console.error(`❌ ${route.collection}:`, err.message || err);
    }
  }

  console.log("\n=====================================");
  console.log(`Total ${DRY_RUN ? "would insert" : "inserted"}: ${totalInserted}`);
  console.log(`Total skipped existing: ${totalSkipped}`);
  console.log(`Missing source collections: ${totalMissingCollections}`);
  console.log("Smart merge finished.");

  await mainConnection.close().catch(() => null);
  await mongoose.disconnect().catch(() => null);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Smart merge failed:", err);
  process.exit(1);
});
