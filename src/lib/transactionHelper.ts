import mongoose from "mongoose";
import type { ClientSession } from "mongoose";

let cachedTransactionSupport: boolean | null = null;

/**
 * Checks whether the currently connected MongoDB deployment supports multi-document transactions.
 * Transactions require a replica set member or mongos cluster.
 * Standalone MongoDB instances (common on single VPS servers) do not support transactions.
 */
export async function isTransactionSupported(): Promise<boolean> {
  if (cachedTransactionSupport !== null) {
    return cachedTransactionSupport;
  }

  if (mongoose.connection.readyState !== 1) {
    // Connection not ready yet; do not cache result prematurely
    return false;
  }

  // 1. Check topology type from client connection
  try {
    const client = (mongoose.connection as any)?.getClient?.();
    const topologyType = client?.topology?.description?.type;
    if (topologyType === "Single") {
      cachedTransactionSupport = false;
      return false;
    }
    if (
      topologyType &&
      (topologyType.startsWith("ReplicaSet") || topologyType === "Sharded")
    ) {
      cachedTransactionSupport = true;
      return true;
    }
  } catch {
    // Continue to command-based check
  }

  // 2. Fallback to { hello: 1 } / { isMaster: 1 } command check
  try {
    const adminDb = mongoose.connection.db?.admin();
    if (adminDb) {
      const res = await adminDb.command({ hello: 1 });
      const isReplicaOrSharded = Boolean(res.setName || res.msg === "isdbgrid");
      cachedTransactionSupport = isReplicaOrSharded;
      return isReplicaOrSharded;
    }
  } catch {
    try {
      const adminDb = mongoose.connection.db?.admin();
      if (adminDb) {
        const res = await adminDb.command({ isMaster: 1 });
        const isReplicaOrSharded = Boolean(res.setName || res.msg === "isdbgrid");
        cachedTransactionSupport = isReplicaOrSharded;
        return isReplicaOrSharded;
      }
    } catch {
      // Ignore
    }
  }

  // If indeterminate, default to attempting transaction
  return true;
}

export function resetTransactionSupportCache(): void {
  cachedTransactionSupport = null;
}

/**
 * Runs a callback inside a MongoDB transaction if supported by the deployment.
 * If running on a standalone MongoDB instance (e.g. VPS without a replica set),
 * gracefully executes without a transaction, preventing:
 * "Error: Transaction numbers are only allowed on a replica set member or mongos".
 */
export async function withOptionalTransaction<T>(
  callback: (session: ClientSession | null) => Promise<T>
): Promise<T> {
  const supported = await isTransactionSupported();
  if (!supported) {
    return await callback(null);
  }

  let session: ClientSession | null = null;
  try {
    session = await mongoose.startSession();
  } catch (err: any) {
    console.warn("[transactionHelper] Failed to start session, falling back:", err?.message);
    cachedTransactionSupport = false;
    return await callback(null);
  }

  let isStandaloneError = false;
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result!;
  } catch (err: any) {
    const errMsg = String(err?.message || "");
    if (
      errMsg.includes("replica set member or mongos") ||
      errMsg.includes("Transaction numbers are only allowed") ||
      err?.code === 20 ||
      err?.codeName === "IllegalOperation"
    ) {
      isStandaloneError = true;
      console.warn(
        "[transactionHelper] Standalone MongoDB detected. Caching status and executing without transaction."
      );
      cachedTransactionSupport = false;
    } else {
      throw err;
    }
  } finally {
    try {
      await session.endSession();
    } catch {
      // Ignore endSession errors
    }
  }

  if (isStandaloneError) {
    return await callback(null);
  }

  throw new Error("[transactionHelper] Transaction ended without result or error.");
}
