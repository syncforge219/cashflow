import dbConnect from "@/lib/db";
import Brand from "@/models/Brand";

/**
 * Brand settings come from the Brands registry, never from names written in code.
 *
 * Default brand = the brand marked "Default" on the Brands page; if none is marked and exactly one
 * brand is active, that one. Otherwise there is no default and callers leave the brand empty so
 * staff can see and fix it, instead of silently filing the record under the wrong brand.
 */
export async function getDefaultBrandName(): Promise<string> {
  try {
    await dbConnect();
    const marked: any = await Brand.findOne({ isDefault: true, status: { $ne: "INACTIVE" } }).select("name").lean();
    if (marked?.name) return String(marked.name).trim();
    const active: any[] = await Brand.find({ status: { $ne: "INACTIVE" } }).select("name").limit(2).lean();
    return active.length === 1 ? String(active[0].name || "").trim() : "";
  } catch (err) {
    console.error("[brandDefaults] Could not resolve default brand:", err);
    return "";
  }
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Brand record by name or code (case-insensitive), or null. */
export async function findBrandByName(name: string | null | undefined): Promise<any | null> {
  const clean = String(name || "").trim();
  if (!clean) return null;
  await dbConnect();
  const rx = new RegExp(`^${escapeRegex(clean)}$`, "i");
  return Brand.findOne({ $or: [{ name: rx }, { code: rx }] }).lean();
}

/** Whether demo-class WhatsApp alerts to teachers are switched on for this brand (Brands page setting). */
export async function brandSendsTeacherDemoAlert(name: string | null | undefined): Promise<boolean> {
  try {
    const brand = await findBrandByName(name);
    return Boolean(brand?.sendTeacherDemoAlert);
  } catch {
    return false;
  }
}

/** Given brand if any, else the user's single brand scope, else the configured default brand, else "". */
export async function resolveBrandName(given?: string | null, userBrandScope?: string | null): Promise<string> {
  const g = String(given || "").trim();
  if (g) return g;
  const scope = String(userBrandScope || "").trim();
  if (scope && !/^(all|all brands|global|\*)$/i.test(scope) && !/[,/|]/.test(scope)) return scope;
  return getDefaultBrandName();
}
