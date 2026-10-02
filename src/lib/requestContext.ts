import { AsyncLocalStorage } from "node:async_hooks";
import mongoose from "mongoose";

export interface RequestContext {
  userId?: mongoose.Types.ObjectId | string | null;
  user?: any | null;
  isSuperAdmin?: boolean;
  includeDeleted?: boolean;
}

const g = globalThis as any;
if (!g.__lead2leadureRequestContextStorage) {
  g.__lead2leadureRequestContextStorage = new AsyncLocalStorage<RequestContext>();
}

export const requestContextStorage: AsyncLocalStorage<RequestContext> = g.__lead2leadureRequestContextStorage;

/**
 * Returns the current request context from AsyncLocalStorage.
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Executes a function within the specified RequestContext.
 */
export function runWithContext<T>(context: RequestContext, fn: () => Promise<T> | T): Promise<T> | T {
  return requestContextStorage.run(context, fn);
}

/**
 * Updates or sets the current user in the active request context.
 */
export function setRequestContextUser(user: any): void {
  const store = requestContextStorage.getStore();
  if (store) {
    store.user = user;
    store.userId = user?._id || user?.id || null;
    const role = (user?.role || "").toLowerCase().trim();
    store.isSuperAdmin = role === "super admin" || role === "super_admin";
  }
}

/**
 * Resolves the authenticated User's ObjectId from request context or explicitly passed ID.
 */
export function getContextUserId(): mongoose.Types.ObjectId | undefined {
  const store = requestContextStorage.getStore();
  const rawId = store?.userId || store?.user?._id || store?.user?.id;
  if (!rawId) return undefined;

  if (rawId instanceof mongoose.Types.ObjectId) {
    return rawId;
  }
  if (mongoose.Types.ObjectId.isValid(String(rawId))) {
    return new mongoose.Types.ObjectId(String(rawId));
  }
  return undefined;
}

/**
 * Checks whether the current context belongs to a Super Admin.
 */
export function isContextSuperAdmin(): boolean {
  const store = requestContextStorage.getStore();
  if (store?.isSuperAdmin !== undefined) {
    return store.isSuperAdmin;
  }
  const role = (store?.user?.role || "").toLowerCase().trim();
  return role === "super admin" || role === "super_admin";
}
