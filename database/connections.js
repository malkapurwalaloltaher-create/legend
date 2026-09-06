const mongoose = require("mongoose");

const DEFAULT_OPTIONS = {
  maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10),
  serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 15000),
};

const connectionCache = global.__legendaryMongoConnectionCache || new Map();
global.__legendaryMongoConnectionCache = connectionCache;

global.__legendaryMongoConnections = global.__legendaryMongoConnections || null;

function cleanUri(value) {
  return String(value || "").trim();
}

function maskMongoUri(uri) {
  const clean = cleanUri(uri);
  if (!clean) return "missing";

  return clean.replace(/\/\/([^:/?#]+):([^@/?#]+)@/g, "//$1:****@");
}

function getMainMongoUri() {
  return cleanUri(process.env.MONGODB_URI || process.env.MONGO_URI || "");
}

function getMongoUriFor(scope) {
  const fallback = getMainMongoUri();

  const uriMap = {
    main: process.env.MONGODB_URI || process.env.MONGO_URI,
    server: process.env.MONGO_SERVER_URI,
    owner: process.env.MONGO_OWNER_URI,
    logs: process.env.MONGO_LOGS_URI,
    customer: process.env.MONGO_CUSTOMER_URI,
    customerServer: process.env.MONGO_CUSTOMER_SERVER_URI,
  };

  return cleanUri(uriMap[scope] || fallback);
}

function createNamedConnection(scope, uri) {
  const clean = cleanUri(uri);

  if (!clean) {
    console.warn(`[Mongo:${scope}] Missing URI. This connection will stay disconnected.`);
    return null;
  }

  const cacheKey = `${scope}:${clean}`;

  if (connectionCache.has(cacheKey)) {
    return connectionCache.get(cacheKey);
  }

  const connection = mongoose.createConnection(clean, DEFAULT_OPTIONS);

  connection.on("connected", () => {
    console.log(`✅ [Mongo:${scope}] connected → ${maskMongoUri(clean)}`);
  });

  connection.on("reconnected", () => {
    console.log(`🔁 [Mongo:${scope}] reconnected`);
  });

  connection.on("disconnected", () => {
    console.warn(`⚠️ [Mongo:${scope}] disconnected`);
  });

  connection.on("error", (err) => {
    console.error(`❌ [Mongo:${scope}] error:`, err.message || err);
  });

  connectionCache.set(cacheKey, connection);
  return connection;
}

function connectMainMongo() {
  const uri = getMainMongoUri();

  if (!uri) {
    console.warn("⚠️ [Mongo:main] MONGODB_URI is missing.");
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 0) {
    mongoose
      .connect(uri, DEFAULT_OPTIONS)
      .then(() => {
        console.log(`✅ [Mongo:main] connected → ${maskMongoUri(uri)}`);
      })
      .catch((err) => {
        console.error("❌ [Mongo:main] connection failed:", err.message || err);
      });
  }

  return mongoose.connection;
}

function connectAllMongoDatabases() {
  if (global.__legendaryMongoConnections) return global.__legendaryMongoConnections;

  const mainDb = connectMainMongo();

  const serverDb =
    createNamedConnection("server", getMongoUriFor("server")) || mainDb;

  const ownerDb =
    createNamedConnection("owner", getMongoUriFor("owner")) || mainDb;

  const logsDb =
    createNamedConnection("logs", getMongoUriFor("logs")) || mainDb;

  const customerDb =
    createNamedConnection("customer", getMongoUriFor("customer")) || mainDb;

  const customerServerDb =
    createNamedConnection("customerServer", getMongoUriFor("customerServer")) || mainDb;

  global.__legendaryMongoConnections = {
    mainDb,
    serverDb,
    ownerDb,
    logsDb,
    customerDb,
    customerServerDb,
  };

  return global.__legendaryMongoConnections;
}

function getDbStatus() {
  const readyStateLabels = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  const statusForConnection = (connection, scope) => {
    const readyState = connection?.readyState ?? 0;

    return {
      scope,
      readyState,
      status: readyStateLabels[readyState] || "unknown",
      name: connection?.name || "",
      host: connection?.host || "",
      port: connection?.port || "",
    };
  };

  const status = {
    main: statusForConnection(mongoose.connection, "main"),
  };

  for (const [cacheKey, connection] of connectionCache.entries()) {
    const scope = cacheKey.split(":")[0];
    status[scope] = statusForConnection(connection, scope);
  }

  return status;
}


function getMainConnection() {
  return mongoose.connection;
}

function getConnectionForScope(scope) {
  const connections = connectAllMongoDatabases();

  const map = {
    main: connections.mainDb,
    server: connections.serverDb,
    owner: connections.ownerDb,
    logs: connections.logsDb,
    customer: connections.customerDb,
    customerServer: connections.customerServerDb,
    serverDb: connections.serverDb,
    ownerDb: connections.ownerDb,
    logsDb: connections.logsDb,
    customerDb: connections.customerDb,
    customerServerDb: connections.customerServerDb,
  };

  return map[scope] || connections.mainDb || mongoose.connection;
}

function getFallbackModel(modelName, schema, scope) {
  const primaryConnection = getConnectionForScope(scope);
  const mainConnection = mongoose.connection;

  const primaryModel =
    primaryConnection.models[modelName] ||
    primaryConnection.model(modelName, schema);

  const mainModel =
    mainConnection.models[modelName] ||
    mainConnection.model(modelName, schema);

  return {
    modelName,
    scope,
    primaryConnection,
    mainConnection,
    primaryModel,
    mainModel,
  };
}

async function findOneWithFallback(modelPack, query = {}, options = {}) {
  const primaryResult = await modelPack.primaryModel.findOne(query, null, options).catch(() => null);
  if (primaryResult) return primaryResult;

  return modelPack.mainModel.findOne(query, null, options).catch(() => null);
}

async function findWithFallback(modelPack, query = {}, projection = null, options = {}) {
  const primaryDocs = await modelPack.primaryModel.find(query, projection, options).catch(() => []);
  if (primaryDocs && primaryDocs.length > 0) return primaryDocs;

  return modelPack.mainModel.find(query, projection, options).catch(() => []);
}

async function countWithFallback(modelPack, query = {}) {
  const primaryCount = await modelPack.primaryModel.countDocuments(query).catch(() => 0);
  if (primaryCount > 0) return primaryCount;

  return modelPack.mainModel.countDocuments(query).catch(() => 0);
}


module.exports = {
  connectAllMongoDatabases,
  connectMainMongo,
  getDbStatus,
  getMongoUriFor,
  maskMongoUri,
  getMainConnection,
  getConnectionForScope,
  getFallbackModel,
  findOneWithFallback,
  findWithFallback,
  countWithFallback,
};
