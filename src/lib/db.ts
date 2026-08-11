import mongoose from "mongoose";
import dns from "node:dns";
import { initEmiReminderCron } from "./emiCron";

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function resolveMongoUri(uri: string): Promise<string> {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;

  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {
    console.warn("Could not set custom DNS servers:", e);
  }

  const match = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)\?(.*)$/);
  if (!match) return uri;

  const [, user, pass, host, dbName, queryParams] = match;
  const srvDomain = `_mongodb._tcp.${host}`;

  try {
    const records = await new Promise<dns.SrvRecord[]>((resolve, reject) => {
      dns.resolveSrv(srvDomain, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });

    if (records && records.length > 0) {
      const hostList = records.map(r => `${r.name}:${r.port}`).join(",");
      return `mongodb://${user}:${encodeURIComponent(pass)}@${hostList}/${dbName}?ssl=true&authSource=admin&${queryParams}`;
    }
  } catch (err: any) {
    console.warn("SRV Resolution fallback notice:", err.message);
  }

  return uri;
}

async function dbConnect() {
  const rawUri = process.env.MONGODB_URI as string;
  if (!rawUri) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env"
    );
  }

  // Auto-start / ensure background worker for overdue EMI WhatsApp reminders
  if (process.env.DISABLE_CRON !== "true") {
    try {
      initEmiReminderCron();
    } catch (err) {
      console.error("Error initializing EMI cron:", err);
    }
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise || mongoose.connection.readyState === 0) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      family: 4,
    };

    cached.promise = (async () => {
      const targetUri = await resolveMongoUri(rawUri);
      return mongoose.connect(targetUri, opts);
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
