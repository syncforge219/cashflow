/**
 * READ-ONLY database health audit. Never writes anything.
 *
 *   node scripts/audit-database.ts            # human-readable report
 *   node scripts/audit-database.ts --json     # machine-readable findings
 *
 * Checks: missing/extra indexes, duplicate business IDs, ID counters behind existing data,
 * broken references, money consistency (balances, paise, fees, EMI plans), date problems,
 * users/sessions, unencrypted secrets and inconsistent brand/course spellings.
 */
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));
process.env.DISABLE_CRON = "true";

// Strictly read-only: loading the models must not build indexes or create collections.
// (Several schemas set autoIndex: NODE_ENV !== "production", which would override the connection.)
(process.env as any).NODE_ENV = "production";
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
interface Finding {
  severity: Severity;
  area: string;
  title: string;
  count?: number;
  samples?: any[];
  detail?: string;
}

const findings: Finding[] = [];
const add = (f: Finding) => {
  if (f.count === 0) return;
  findings.push(f);
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const sample = <T>(arr: T[], n = 5) => arr.slice(0, n);

async function resolveMongoUri(uri: string): Promise<string> {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch {}
  const m = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)\?(.*)$/);
  if (!m) return uri;
  try {
    const recs = await new Promise<dns.SrvRecord[]>((res, rej) =>
      dns.resolveSrv(`_mongodb._tcp.${m[3]}`, (e, a) => (e ? rej(e) : res(a)))
    );
    if (recs.length) {
      return `mongodb://${m[1]}:${encodeURIComponent(m[2])}@${recs.map((r) => `${r.name}:${r.port}`).sort().join(",")}/${m[4]}?ssl=true&authSource=admin&${m[5]}`;
    }
  } catch {}
  return uri;
}

export async function runAudit(): Promise<Finding[]> {
  findings.length = 0;
  const db = mongoose.connection.db!;
  const col = (name: string) => db.collection(name);
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  const has = (name: string) => existing.has(name);

  // Load every model so mongoose knows the declared schemas/indexes
  const modelDir = path.resolve(process.cwd(), "src", "models");
  for (const file of fs.readdirSync(modelDir).filter((f) => f.endsWith(".ts"))) {
    try {
      await import(`@/models/${file.replace(/\.ts$/, "")}`);
    } catch (err: any) {
      add({ severity: "LOW", area: "Schema", title: `Model ${file} failed to load`, detail: err.message });
    }
  }

  // ------------------------------------------------------------------ inventory
  const counts: Record<string, number> = {};
  for (const name of existing) counts[name] = await col(name).estimatedDocumentCount();
  const modelCollections = new Set(Object.values(mongoose.models).map((m) => m.collection.collectionName));
  const orphanCollections = [...existing].filter((c) => !modelCollections.has(c) && !c.startsWith("system."));
  add({
    severity: "INFO",
    area: "Inventory",
    title: "Collections and document counts",
    detail: Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join(", "),
  });
  add({
    severity: "LOW",
    area: "Inventory",
    title: "Collections with no model in the code (leftovers or typos)",
    count: orphanCollections.length,
    samples: orphanCollections.map((c) => `${c} (${counts[c]} docs)`),
  });

  // ------------------------------------------------------------------ indexes
  const missingUnique: string[] = [];
  const missingOther: string[] = [];
  const extra: string[] = [];
  for (const model of Object.values(mongoose.models)) {
    const name = model.collection.collectionName;
    if (!has(name)) continue;
    try {
      const diff = await model.diffIndexes();
      for (const spec of diff.toCreate as any[]) {
        const key = JSON.stringify(spec.key ?? spec);
        const unique = spec.options?.unique ?? spec.unique;
        (unique ? missingUnique : missingOther).push(`${name} ${key}${unique ? " UNIQUE" : ""}`);
      }
      for (const idx of diff.toDrop as any[]) extra.push(`${name}.${typeof idx === "string" ? idx : JSON.stringify(idx)}`);
    } catch (err: any) {
      add({ severity: "LOW", area: "Indexes", title: `Could not diff indexes for ${name}`, detail: err.message });
    }
  }
  add({
    severity: "HIGH",
    area: "Indexes",
    title: "UNIQUE indexes declared in code but missing in the database (duplicates are not prevented)",
    count: missingUnique.length,
    samples: missingUnique,
  });
  add({
    severity: "MEDIUM",
    area: "Indexes",
    title: "Indexes declared in code but missing in the database (slower queries)",
    count: missingOther.length,
    samples: sample(missingOther, 40),
  });
  add({
    severity: "LOW",
    area: "Indexes",
    title: "Indexes in the database that the code no longer declares",
    count: extra.length,
    samples: sample(extra, 40),
  });

  // ------------------------------------------------------------------ duplicates
  const dupes = async (collection: string, field: string, severity: Severity, label: string, filter: any = {}) => {
    if (!has(collection)) return;
    const rows = await col(collection)
      .aggregate([
        { $match: { ...filter, [field]: { $nin: [null, ""] } } },
        { $group: { _id: { $toLower: { $toString: `$${field}` } }, n: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { n: { $gt: 1 } } },
      ])
      .toArray();
    add({
      severity,
      area: "Duplicates",
      title: `Duplicate ${label} (${collection}.${field})`,
      count: rows.length,
      samples: sample(rows.map((r) => `${r._id} ×${r.n}`)),
    });
  };
  await dupes("admissions", "admissionId", "HIGH", "admission IDs");
  await dupes("enquiries", "enquiryId", "HIGH", "enquiry IDs");
  await dupes("payments", "receiptNo", "CRITICAL", "receipt numbers");
  await dupes("students", "studentCode", "HIGH", "student codes");
  await dupes("users", "email", "HIGH", "user emails");
  await dupes("brands", "name", "MEDIUM", "brand names");
  await dupes("companies", "name", "MEDIUM", "company names");
  await dupes("courses", "name", "LOW", "course names");
  await dupes("admissions", "mobileNumber", "INFO", "admission mobile numbers (may be legitimate re-enrolments)", { isDeleted: { $ne: true } });

  // ------------------------------------------------------------------ counters
  if (has("counters")) {
    const counters = await col("counters").find().toArray();
    const behind: string[] = [];
    const checks: { counter: string; collection: string; field: string; re: RegExp }[] = [
      { counter: "admissionId", collection: "admissions", field: "admissionId", re: /^ADM(\d+)$/ },
      { counter: "enquiryId", collection: "enquiries", field: "enquiryId", re: /^ENQ(\d+)$/ },
      { counter: "batchId", collection: "batches", field: "batchId", re: /^BAT(\d+)$/ },
      { counter: "studentCode", collection: "students", field: "studentCode", re: /^STU-?(?:\d{4}-)?(\d+)$/ },
    ];
    for (const year of new Set(counters.map((c: any) => c.name).filter((n: string) => /^receiptNo_\d{4}$/.test(n)))) {
      const y = (year as string).slice(-4);
      checks.push({ counter: year as string, collection: "payments", field: "receiptNo", re: new RegExp(`^REC-${y}-(\\d+)$`) });
    }
    for (const c of checks) {
      if (!has(c.collection)) continue;
      const counter = counters.find((x: any) => x.name === c.counter);
      const values = await col(c.collection).distinct(c.field);
      const max = Math.max(0, ...values.map((v: any) => Number(c.re.exec(String(v))?.[1] || 0)));
      if (counter && Number(counter.seq) < max) {
        behind.push(`${c.counter}: counter at ${counter.seq}, highest existing ${max} -> next IDs collide`);
      }
    }
    add({
      severity: "CRITICAL",
      area: "ID counters",
      title: "ID counters behind existing data (new records will fail with duplicate-key errors)",
      count: behind.length,
      samples: behind,
    });
  }

  // ------------------------------------------------------------------ references
  const idSet = async (collection: string) =>
    has(collection) ? new Set((await col(collection).distinct("_id")).map(String)) : new Set<string>();
  const [admIds, enqIds, stuIds, brandIds, compIds, batchIds, userIds] = await Promise.all(
    ["admissions", "enquiries", "students", "brands", "companies", "batches", "users"].map(idSet)
  );
  const liveAdm = has("admissions")
    ? new Set((await col("admissions").distinct("_id", { isDeleted: { $ne: true } })).map(String))
    : new Set<string>();

  const refCheck = async (
    collection: string,
    field: string,
    target: Set<string>,
    severity: Severity,
    label: string,
    filter: any = {}
  ) => {
    if (!has(collection)) return;
    const docs = await col(collection)
      .find({ ...filter, [field]: { $nin: [null, ""] } })
      .project({ [field]: 1 })
      .toArray();
    const bad = docs.filter((d: any) => {
      const v = field.split(".").reduce((o: any, k) => o?.[k], d);
      return v != null && v !== "" && !target.has(String(v));
    });
    add({
      severity,
      area: "References",
      title: `${label} (${collection}.${field} points to nothing)`,
      count: bad.length,
      samples: sample(bad.map((d: any) => String(d._id))),
    });
  };
  await refCheck("payments", "admissionId", admIds, "CRITICAL", "Payments for admissions that do not exist");
  await refCheck("admissions", "studentId", stuIds, "MEDIUM", "Admissions linked to a missing student record");
  await refCheck("enquiries", "studentId", stuIds, "MEDIUM", "Enquiries linked to a missing student record");
  await refCheck("admissions", "enquiryId", enqIds, "LOW", "Admissions linked to a missing enquiry");
  await refCheck("admissions", "brandId", brandIds, "MEDIUM", "Admissions with a missing brand");
  await refCheck("admissions", "companyId", compIds, "MEDIUM", "Admissions with a missing company");
  await refCheck("admissions", "batchId", batchIds, "LOW", "Admissions with a missing batch");
  await refCheck("admissions", "counsellorId", userIds, "LOW", "Admissions with a missing counsellor user");
  await refCheck("payments", "brandId", brandIds, "MEDIUM", "Payments with a missing brand");
  await refCheck("payments", "companyId", compIds, "MEDIUM", "Payments with a missing company");
  await refCheck("enquiries", "targetBrandId", brandIds, "LOW", "Enquiries with a missing brand");
  await refCheck("tasks", "linkedEnquiryId", enqIds, "LOW", "Tasks linked to a missing enquiry");

  if (has("payments")) {
    const onDeleted = await col("payments")
      .find({ isDeleted: { $ne: true } })
      .project({ admissionId: 1, receiptNo: 1, amountReceived: 1 })
      .toArray();
    const bad = onDeleted.filter((p: any) => p.admissionId && admIds.has(String(p.admissionId)) && !liveAdm.has(String(p.admissionId)));
    add({
      severity: "HIGH",
      area: "References",
      title: "Active payments belonging to DELETED admissions (still counted in collection reports)",
      count: bad.length,
      samples: sample(bad.map((p: any) => `${p.receiptNo || p._id} ₹${p.amountReceived}`)),
    });
  }

  // Missing studentId (students master migration)
  for (const c of ["admissions", "enquiries"]) {
    if (!has(c)) continue;
    const n = await col(c).countDocuments({ isDeleted: { $ne: true }, $or: [{ studentId: null }, { studentId: { $exists: false } }] });
    add({ severity: "MEDIUM", area: "References", title: `${c} without a student master record (studentId)`, count: n });
  }

  // Brand name vs brandId disagreement
  if (has("admissions") && has("brands")) {
    const brands = await col("brands").find().project({ name: 1 }).toArray();
    const nameById = new Map(brands.map((b: any) => [String(b._id), String(b.name || "").trim().toLowerCase()]));
    for (const c of ["admissions", "payments"]) {
      if (!has(c)) continue;
      const docs = await col(c).find({ brandId: { $ne: null }, brand: { $nin: [null, ""] } }).project({ brand: 1, brandId: 1 }).toArray();
      const bad = docs.filter((d: any) => nameById.has(String(d.brandId)) && nameById.get(String(d.brandId)) !== String(d.brand).trim().toLowerCase());
      add({
        severity: "MEDIUM",
        area: "References",
        title: `${c}: brand name and brandId disagree (reports filter on both, so these land in different brands)`,
        count: bad.length,
        samples: sample(bad.map((d: any) => `${d._id}: "${d.brand}" vs ${nameById.get(String(d.brandId))}`)),
      });
    }
  }

  // ------------------------------------------------------------------ money
  if (has("payments")) {
    const pays = await col("payments").find().toArray();
    const live = pays.filter((p: any) => !p.isDeleted);
    add({
      severity: "HIGH",
      area: "Money",
      title: "Payments with zero/negative/missing amount",
      count: live.filter((p: any) => !(Number(p.amountReceived) > 0)).length,
      samples: sample(live.filter((p: any) => !(Number(p.amountReceived) > 0)).map((p: any) => `${p.receiptNo || p._id}: ${p.amountReceived}`)),
    });
    const paiseBad = pays.filter((p: any) => Number(p.amountReceivedPaise) > 0 && Math.round(Number(p.amountReceived) * 100) !== Number(p.amountReceivedPaise));
    add({
      severity: "CRITICAL",
      area: "Money",
      title: "Payments whose rupee and paise amounts disagree (balances use paise, receipts show rupees)",
      count: paiseBad.length,
      samples: sample(paiseBad.map((p: any) => `${p.receiptNo || p._id}: ₹${p.amountReceived} vs ${p.amountReceivedPaise} paise`)),
    });
    const noPaise = live.filter((p: any) => !(Number(p.amountReceivedPaise) > 0));
    add({ severity: "LOW", area: "Money", title: "Payments without a paise value (rupee value is used as fallback)", count: noPaise.length });
    add({
      severity: "MEDIUM",
      area: "Dates",
      title: "Payments without a payment date (fall back to entry time)",
      count: live.filter((p: any) => !p.paymentDate).length,
    });
    const now = Date.now();
    const future = live.filter((p: any) => p.paymentDate && new Date(p.paymentDate).getTime() > now + 24 * 3600 * 1000);
    add({ severity: "HIGH", area: "Dates", title: "Payments dated in the future", count: future.length, samples: sample(future.map((p: any) => `${p.receiptNo}: ${p.paymentDate}`)) });
    const noReceipt = live.filter((p: any) => !p.receiptNo);
    add({ severity: "HIGH", area: "Money", title: "Payments without a receipt number", count: noReceipt.length, samples: sample(noReceipt.map((p: any) => String(p._id))) });
  }

  if (has("admissions")) {
    const adms = await col("admissions")
      .aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $lookup: {
            from: "payments",
            let: { id: "$_id" },
            pipeline: [{ $match: { $expr: { $eq: ["$admissionId", "$$id"] }, isDeleted: { $ne: true } } }, { $project: { amountReceived: 1, amountReceivedPaise: 1 } }],
            as: "pays",
          },
        },
      ])
      .toArray();

    const stale: string[] = [];
    const overpaid: string[] = [];
    const feePaise: string[] = [];
    const feeMath: string[] = [];
    const planMismatch: string[] = [];
    const dpTooBig: string[] = [];
    const zeroFee: string[] = [];
    for (const a of adms as any[]) {
      const fee = Number(a.finalFeePaise) > 0 ? a.finalFeePaise / 100 : Number(a.finalFee) || Number(a.courseFee) || 0;
      const paid = round2(
        a.pays.reduce((s: number, p: any) => s + (Number(p.amountReceivedPaise) > 0 ? p.amountReceivedPaise / 100 : Number(p.amountReceived) || 0), 0)
      );
      const real = round2(Math.max(0, fee - paid));
      const label = `${a.admissionId || a._id} (${a.fullName || "?"})`;
      if (Math.abs(real - (Number(a.remainingBalance) || 0)) > 1) stale.push(`${label}: stored ₹${a.remainingBalance}, actual ₹${real}`);
      if (paid > fee + 1 && fee > 0) overpaid.push(`${label}: fee ₹${fee}, paid ₹${paid}`);
      if (Number(a.finalFeePaise) > 0 && Math.round(Number(a.finalFee) * 100) !== Number(a.finalFeePaise)) feePaise.push(`${label}: ₹${a.finalFee} vs ${a.finalFeePaise} paise`);
      if (!(fee > 0)) zeroFee.push(label);
      const course = Number(a.courseFee) || 0;
      const disc = Number(a.totalDiscount) || 0;
      if (course > 0 && Number(a.finalFee) > 0 && disc >= 0 && Math.abs(course - disc - Number(a.finalFee)) > 1 && Number(a.finalFee) !== course)
        feeMath.push(`${label}: course ₹${course} − discount ₹${disc} ≠ final ₹${a.finalFee}`);
      const plan = Array.isArray(a.customEmiPlan) ? a.customEmiPlan : [];
      if (plan.length) {
        const planSum = round2(plan.reduce((s: number, e: any) => s + (Number(e?.amount) || 0), 0));
        const expected = round2(fee - (Number(a.registrationAmount) || 0) - (Number(a.downpaymentAmount) || 0));
        if (Math.abs(planSum - expected) > 1) planMismatch.push(`${label}: EMI plan ₹${planSum}, expected ₹${expected}`);
        const noDate = plan.filter((e: any) => !e?.dueDate).length;
        if (noDate) planMismatch.push(`${label}: ${noDate} instalment(s) without a due date`);
      }
      if ((Number(a.downpaymentAmount) || 0) + (Number(a.registrationAmount) || 0) > fee + 1 && fee > 0)
        dpTooBig.push(`${label}: registration ₹${a.registrationAmount} + down payment ₹${a.downpaymentAmount} > fee ₹${fee}`);
    }
    add({ severity: "MEDIUM", area: "Money", title: "Stored remainingBalance differs from fee − actual payments (screens that read the stored field show wrong dues)", count: stale.length, samples: sample(stale, 10) });
    add({ severity: "HIGH", area: "Money", title: "Students who paid more than their fee", count: overpaid.length, samples: sample(overpaid, 10) });
    add({ severity: "HIGH", area: "Money", title: "Admissions whose rupee and paise fee disagree", count: feePaise.length, samples: sample(feePaise, 10) });
    add({ severity: "MEDIUM", area: "Money", title: "Admissions with no fee recorded", count: zeroFee.length, samples: sample(zeroFee, 10) });
    add({ severity: "LOW", area: "Money", title: "Course fee − total discount does not equal final fee", count: feeMath.length, samples: sample(feeMath, 10) });
    add({ severity: "MEDIUM", area: "Money", title: "EMI plans that do not add up to fee − registration − down payment, or lack due dates", count: planMismatch.length, samples: sample(planMismatch, 10) });
    add({ severity: "HIGH", area: "Money", title: "Registration + down payment larger than the whole fee", count: dpTooBig.length, samples: sample(dpTooBig, 10) });

    // dates on admissions
    const noAdmDate = adms.filter((a: any) => !a.admissionDate).length;
    add({ severity: "LOW", area: "Dates", title: "Admissions without an admission date (reports fall back to creation time)", count: noAdmDate });
  }

  // ------------------------------------------------------------------ date types & sanity
  const dateFields: Record<string, string[]> = {
    admissions: ["admissionDate", "startDate", "downpaymentDueDate", "paymentDate", "createdAt"],
    payments: ["paymentDate", "createdAt"],
    enquiries: ["createdAt"],
    expenses: ["expenseDate", "createdAt"],
    tasks: ["dueDate", "createdAt"],
    batches: ["startDate", "endDate"],
  };
  const wrongType: string[] = [];
  const implausible: string[] = [];
  for (const [c, fields] of Object.entries(dateFields)) {
    if (!has(c)) continue;
    for (const f of fields) {
      const n = await col(c).countDocuments({ [f]: { $exists: true, $nin: [null, ""], $not: { $type: "date" } } });
      if (n) wrongType.push(`${c}.${f}: ${n} stored as text/number instead of a date`);
      const bad = await col(c).countDocuments({
        $or: [{ [f]: { $type: "date", $lt: new Date("2000-01-01") } }, { [f]: { $type: "date", $gt: new Date("2100-01-01") } }],
      });
      if (bad) implausible.push(`${c}.${f}: ${bad} before 2000 or after 2100`);
    }
  }
  add({ severity: "MEDIUM", area: "Dates", title: "Date fields stored with the wrong type (date filters and sorting skip them)", count: wrongType.length, samples: wrongType });
  add({ severity: "MEDIUM", area: "Dates", title: "Implausible dates", count: implausible.length, samples: implausible });

  if (has("enquiries")) {
    const badStr = await col("enquiries").countDocuments({ date: { $exists: true, $nin: [null, ""], $not: /^\d{4}-\d{2}-\d{2}$/ } });
    add({ severity: "MEDIUM", area: "Dates", title: "Enquiry 'date' values not in YYYY-MM-DD (string comparisons in follow-ups break)", count: badStr });
    const badFollow = await col("enquiries")
      .aggregate([{ $unwind: "$followUps" }, { $match: { "followUps.date": { $exists: true, $nin: [null, ""], $not: /^\d{4}-\d{2}-\d{2}$/ } } }, { $count: "n" }])
      .toArray();
    add({ severity: "MEDIUM", area: "Dates", title: "Follow-up dates not in YYYY-MM-DD", count: badFollow[0]?.n || 0 });
  }

  // ------------------------------------------------------------------ users & sessions
  if (has("users")) {
    const users = await col("users").find().project({ email: 1, password: 1, role: 1, name: 1 }).toArray();
    const plain = users.filter((u: any) => u.password && !/^\$2[aby]\$\d{2}\$/.test(String(u.password)));
    add({ severity: "CRITICAL", area: "Security", title: "Users whose password is not bcrypt-hashed (stored readable)", count: plain.length, samples: sample(plain.map((u: any) => u.email || u.name)) });
    const noRole = users.filter((u: any) => !String(u.role || "").trim());
    add({ severity: "MEDIUM", area: "Security", title: "Users without a role", count: noRole.length, samples: sample(noRole.map((u: any) => u.email || u.name)) });
    const roles = new Map<string, number>();
    users.forEach((u: any) => roles.set(String(u.role || "(none)"), (roles.get(String(u.role || "(none)")) || 0) + 1));
    add({ severity: "INFO", area: "Security", title: "Role spellings in use (several variants of the same role break role checks)", detail: [...roles.entries()].map(([r, n]) => `"${r}" ×${n}`).join(", ") });
  }
  if (has("sessions")) {
    const expired = await col("sessions").countDocuments({ expiresAt: { $lt: new Date() } });
    const ttl = (await col("sessions").indexes()).some((i: any) => i.expireAfterSeconds !== undefined);
    add({ severity: ttl ? "LOW" : "MEDIUM", area: "Security", title: `Expired sessions still stored${ttl ? "" : " (no TTL index to remove them)"}`, count: expired });
  }

  // ------------------------------------------------------------------ encryption of secrets
  const secrets: { c: string; f: string }[] = [
    { c: "justdialconfigs", f: "apiKey" },
    { c: "justdialconfigs", f: "webhookSecret" },
    { c: "justdialconfigs", f: "pullApiKey" },
    { c: "facebookleadconfigs", f: "appSecret" },
    { c: "facebookleadconfigs", f: "pageAccessToken" },
    { c: "softwares", f: "licenseKey" },
    { c: "companies", f: "bankDetails.accountNumber" },
    { c: "quotationprofiles", f: "bankDetails.accountNumber" },
  ];
  const unenc: string[] = [];
  for (const s of secrets) {
    if (!has(s.c)) continue;
    const n = await col(s.c).countDocuments({ [s.f]: { $type: "string", $nin: [""], $not: /^enc:v1:/ } });
    if (n) unenc.push(`${s.c}.${s.f}: ${n}`);
  }
  add({ severity: "HIGH", area: "Security", title: "Secrets stored unencrypted (run scripts/encrypt-fields.ts)", count: unenc.length, samples: unenc });

  // ------------------------------------------------------------------ inconsistent spellings
  const spellings = async (c: string, f: string, label: string) => {
    if (!has(c)) return;
    const vals = (await col(c).distinct(f)).filter((v: any) => typeof v === "string" && v.trim());
    const groups = new Map<string, Set<string>>();
    vals.forEach((v: string) => {
      const k = v.toLowerCase().replace(/[\s._-]+/g, " ").trim();
      if (!groups.has(k)) groups.set(k, new Set());
      groups.get(k)!.add(v);
    });
    const multi = [...groups.values()].filter((g) => g.size > 1).map((g) => [...g].map((x) => `"${x}"`).join(" / "));
    add({ severity: "MEDIUM", area: "Consistency", title: `${label} spelled several ways (${c}.${f}); exact-match filters split them`, count: multi.length, samples: sample(multi, 10) });
  };
  await spellings("admissions", "brand", "Brand names");
  await spellings("payments", "brand", "Brand names");
  await spellings("enquiries", "targetBrand", "Brand names");
  await spellings("admissions", "course", "Course names");
  await spellings("admissions", "counsellor", "Counsellor names");
  await spellings("enquiries", "leadSource", "Lead sources");
  await spellings("enquiries", "status", "Enquiry statuses");
  await spellings("payments", "company", "Company names");

  // ------------------------------------------------------------------ soft delete hygiene
  for (const c of ["admissions", "payments", "enquiries", "students", "expenses"]) {
    if (!has(c)) continue;
    const n = await col(c).countDocuments({ isDeleted: { $exists: false } });
    add({ severity: "INFO", area: "Consistency", title: `${c} without an isDeleted flag (treated as not deleted)`, count: n });
  }

  return findings;
}

const ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

async function main() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") process.loadEnvFile(envPath);
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set (.env).");
  await mongoose.connect(await resolveMongoUri(process.env.MONGODB_URI), { autoIndex: false, autoCreate: false });
  try {
    const result = await runAudit();
    result.sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify({ database: mongoose.connection.name, findings: result }, null, 2));
      return;
    }
    console.log(`Database: ${mongoose.connection.name}  (read-only audit)\n`);
    for (const f of result) {
      console.log(`[${f.severity}] ${f.area} — ${f.title}${f.count !== undefined ? `: ${f.count}` : ""}`);
      if (f.detail) console.log(`    ${f.detail}`);
      for (const s of f.samples || []) console.log(`    · ${s}`);
    }
    const tally = ORDER.map((s) => `${s}: ${result.filter((f) => f.severity === s).length}`).join("  ");
    console.log(`\n${tally}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith("audit-database.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Audit failed:", err);
      process.exit(1);
    });
}
