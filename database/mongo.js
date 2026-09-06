const mongoose = require("mongoose");

async function connectMongo() {
  console.log("🚀 Starting Mongo connection...");
  console.log("🟡 Trying to connect to MongoDB...");

  if (!process.env.MONGODB_URI) {
    console.error("🔴 MONGODB_URI is missing in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
    });

    console.log("🟢 MongoDB connected successfully!");
  } catch (err) {
    console.error("🔴 MongoDB connection error:", err.message);
    console.error("❌ Bot stopped because MongoDB is required.");
    process.exit(1);
  }
}

module.exports = connectMongo;