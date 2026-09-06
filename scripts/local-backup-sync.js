/* eslint-disable no-console */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const BACKUP_DIR = process.env.LOCAL_BACKUP_DIR || path.join(process.cwd(), "local-backups");
const MODE = process.argv.includes("--pull") ? "pull" : "status";

const COLLECTIONS = [
  "dashboardembedtemplates",
  "dashboardautomessages",
  "dashboardwelcomegoodbyes",
  "dashboardmoduleconfigs",
  "guildplans",
  "guildmoduleunlocks",
  "customeraccounts",
  "dashboardsupportconfigs",
  "dashboardactionlogs",
  "dashboardloginlogs",
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function pullMongoToFiles() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGODB_URI or MONGO_URI");

  ensureDir(BACKUP_DIR);

  const conn = await mongoose.createConnection(uri).asPromise();
  const db = conn.db;

  for (const collectionName of COLLECTIONS) {
    const exists = await db.listCollections({ name: collectionName }).toArray();
    if (!exists.length) {
      console.log(`⏭️  ${collectionName}: not found`);
      continue;
    }

    const docs = await db.collection(collectionName).find({}).toArray();
    const filePath = path.join(BACKUP_DIR, `${collectionName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), "utf8");
    console.log(`✅ ${collectionName}: saved ${docs.length} docs → ${filePath}`);
  }

  await conn.close();
}

async function main() {
  console.log("💾 Legendary Bot Local Backup Sync");
  console.log("This is for your laptop only. Railway cannot write to your laptop when it is off.");
  console.log(`Backup folder: ${BACKUP_DIR}`);

  if (MODE === "pull") {
    await pullMongoToFiles();
  } else {
    console.log("Run: node scripts/local-backup-sync.js --pull");
  }
}

main().catch((err) => {
  console.error("❌ Local backup sync failed:", err);
  process.exit(1);
});
