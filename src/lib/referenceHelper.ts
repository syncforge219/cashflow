import mongoose from "mongoose";

// Helper to safely get or dynamically import models without circular dependency issues
async function getModel(name: string, importFn: () => Promise<any>): Promise<mongoose.Model<any>> {
  if (mongoose.models[name]) {
    return mongoose.models[name];
  }
  const mod = await importFn();
  return mod.default || mod;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface LookupResult<T = any> {
  status: "matched" | "zero" | "multiple";
  record?: T;
  matches?: T[];
}

/**
 * Look up a Brand by ObjectId, brand name, code, or brandId.
 * Never guesses if 0 or multiple matches exist.
 */
export async function lookupBrand(
  val: any,
  session?: mongoose.ClientSession | null
): Promise<LookupResult> {
  if (!val) return { status: "zero" };

  const Brand = await getModel("Brand", () => import("@/models/Brand"));

  if (val instanceof mongoose.Types.ObjectId || (typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val))) {
    const q = Brand.findById(val);
    if (session) q.session(session);
    const byId = await q.lean();
    if (byId) return { status: "matched", record: byId };
  }

  const str = String(val).trim();
  if (!str || ["all brands", "all", "n/a", "none"].includes(str.toLowerCase())) {
    return { status: "zero" };
  }

  const regex = new RegExp(`^${escapeRegex(str)}$`, "i");
  const q = Brand.find({
    $or: [{ name: { $regex: regex } }, { code: { $regex: regex } }, { brandId: { $regex: regex } }],
  });
  if (session) q.session(session);
  const matches = await q.lean();

  if (matches.length === 1) {
    return { status: "matched", record: matches[0] };
  }
  if (matches.length > 1) {
    return { status: "multiple", matches };
  }
  return { status: "zero" };
}

/**
 * Look up a Company by ObjectId, company name, legalName, or companyId.
 * Never guesses if 0 or multiple matches exist.
 */
export async function lookupCompany(
  val: any,
  session?: mongoose.ClientSession | null
): Promise<LookupResult> {
  if (!val) return { status: "zero" };

  const Company = await getModel("Company", () => import("@/models/Company"));

  if (val instanceof mongoose.Types.ObjectId || (typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val))) {
    const q = Company.findById(val);
    if (session) q.session(session);
    const byId = await q.lean();
    if (byId) return { status: "matched", record: byId };
  }

  const str = String(val).trim();
  if (
    !str ||
    ["cash", "unallocated", "cash (unallocated)", "all companies", "all", "n/a", "none"].includes(
      str.toLowerCase()
    )
  ) {
    return { status: "zero" };
  }

  const regex = new RegExp(`^${escapeRegex(str)}$`, "i");
  const q = Company.find({
    $or: [
      { name: { $regex: regex } },
      { legalName: { $regex: regex } },
      { companyId: { $regex: regex } },
      { uniqueId: { $regex: regex } },
    ],
  });
  if (session) q.session(session);
  const matches = await q.lean();

  if (matches.length === 1) {
    return { status: "matched", record: matches[0] };
  }
  if (matches.length > 1) {
    return { status: "multiple", matches };
  }
  return { status: "zero" };
}

/**
 * Look up a User (counsellor / CRM advisor) by ObjectId, name, or email.
 * Never guesses if 0 or multiple matches exist.
 */
export async function lookupUser(
  val: any,
  session?: mongoose.ClientSession | null
): Promise<LookupResult> {
  if (!val) return { status: "zero" };

  const User = await getModel("User", () => import("@/models/User"));

  if (val instanceof mongoose.Types.ObjectId || (typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val))) {
    const q = User.findById(val);
    if (session) q.session(session);
    const byId = await q.lean();
    if (byId) return { status: "matched", record: byId };
  }

  const str = String(val).trim();
  if (
    !str ||
    ["unassigned", "staff", "counsellor", "counselor", "advisor", "admin", "system", "n/a", "none"].includes(
      str.toLowerCase()
    )
  ) {
    return { status: "zero" };
  }

  const regex = new RegExp(`^${escapeRegex(str)}$`, "i");
  const q = User.find({
    $or: [{ name: { $regex: regex } }, { email: { $regex: regex } }],
  });
  if (session) q.session(session);
  const matches = await q.lean();

  if (matches.length === 1) {
    return { status: "matched", record: matches[0] };
  }
  if (matches.length > 1) {
    return { status: "multiple", matches };
  }
  return { status: "zero" };
}

/**
 * Look up a Batch by ObjectId, batchId (e.g. BAT000001), or batchName.
 * Never guesses if 0 or multiple matches exist.
 */
export async function lookupBatch(
  val: any,
  session?: mongoose.ClientSession | null
): Promise<LookupResult> {
  if (!val) return { status: "zero" };

  const Batch = await getModel("Batch", () => import("@/models/Batch"));

  if (val instanceof mongoose.Types.ObjectId || (typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val))) {
    const q = Batch.findById(val);
    if (session) q.session(session);
    const byId = await q.lean();
    if (byId) return { status: "matched", record: byId };
  }

  const str = String(val).trim();
  if (
    !str ||
    ["unassigned", "general batch", "n/a", "none", "all", "all batches"].includes(str.toLowerCase())
  ) {
    return { status: "zero" };
  }

  // 1. Try exact batchId (e.g. BAT000001)
  const qBatchId = Batch.findOne({ batchId: new RegExp(`^${escapeRegex(str)}$`, "i") });
  if (session) qBatchId.session(session);
  const byBatchId = await qBatchId.lean();
  if (byBatchId) return { status: "matched", record: byBatchId };

  // 2. Try batchName
  const regex = new RegExp(`^${escapeRegex(str)}$`, "i");
  const qName = Batch.find({ batchName: { $regex: regex } });
  if (session) qName.session(session);
  const matches = await qName.lean();

  if (matches.length === 1) {
    return { status: "matched", record: matches[0] };
  }
  if (matches.length > 1) {
    return { status: "multiple", matches };
  }
  return { status: "zero" };
}

/**
 * Resolve an enquiryId reference to a standard ObjectId.
 * Supports 24-hex string and ENQ- sequence numbers.
 */
export async function resolveEnquiryObjectId(
  val: any,
  session?: mongoose.ClientSession | null
): Promise<mongoose.Types.ObjectId | null> {
  if (!val) return null;
  if (val instanceof mongoose.Types.ObjectId) return val;

  const str = String(val).trim();
  if (!str) return null;

  const Enquiry = await getModel("Enquiry", () => import("@/models/Enquiry"));

  if (/^[0-9a-fA-F]{24}$/.test(str)) {
    const objId = new mongoose.Types.ObjectId(str);
    const q = Enquiry.findById(objId).select("_id");
    if (session) q.session(session);
    const exists = await q.lean();
    if (exists) return objId;
  }

  // Check if it is an enquiry sequence ID (e.g. ENQ-2026-0001)
  const qSeq = Enquiry.findOne({ enquiryId: str }).select("_id");
  if (session) qSeq.session(session);
  const bySeq = await qSeq.lean();
  if (bySeq && bySeq._id) {
    return bySeq._id as mongoose.Types.ObjectId;
  }

  return null;
}

/**
 * Dual-write synchronization for Admission documents and update payloads.
 */
export async function syncAdmissionRefs(
  target: any,
  session?: mongoose.ClientSession | null
): Promise<void> {
  if (!target) return;

  // 1. Brand <-> BrandId
  if (target.brandId) {
    if (!target.brand) {
      const res = await lookupBrand(target.brandId, session);
      if (res.status === "matched" && res.record?.name) {
        target.brand = res.record.name;
      }
    }
  } else if (target.brand) {
    const res = await lookupBrand(target.brand, session);
    if (res.status === "matched" && res.record?._id) {
      target.brandId = res.record._id;
    }
  }

  // 2. CompanyAssigned <-> CompanyId
  if (target.companyId) {
    if (!target.companyAssigned) {
      const res = await lookupCompany(target.companyId, session);
      if (res.status === "matched" && res.record?.name) {
        target.companyAssigned = res.record.name;
      }
    }
  } else if (target.companyAssigned) {
    const res = await lookupCompany(target.companyAssigned, session);
    if (res.status === "matched" && res.record?._id) {
      target.companyId = res.record._id;
    }
  }

  // 3. Counsellor <-> CounsellorId
  if (target.counsellorId) {
    if (!target.counsellor) {
      const res = await lookupUser(target.counsellorId, session);
      if (res.status === "matched" && res.record?.name) {
        target.counsellor = res.record.name;
      }
    }
  } else if (target.counsellor) {
    const res = await lookupUser(target.counsellor, session);
    if (res.status === "matched" && res.record?._id) {
      target.counsellorId = res.record._id;
    }
  }

  // 4. Standardize enquiryId to ObjectId
  if (target.enquiryId && typeof target.enquiryId === "string") {
    const resolvedEnqId = await resolveEnquiryObjectId(target.enquiryId, session);
    if (resolvedEnqId) {
      target.enquiryId = resolvedEnqId;
    }
  }

  // 5. Batch <-> BatchId (ObjectId ref Batch)
  const batchStr = target.batchAssigned || target.batch;
  if (target.batchId) {
    const res = await lookupBatch(target.batchId, session);
    if (res.status === "matched" && res.record) {
      target.batchId = res.record._id;
      if (!target.batchAssigned) target.batchAssigned = res.record.batchName;
      if (!target.batch) target.batch = res.record.batchName;
    }
  } else if (batchStr) {
    const res = await lookupBatch(batchStr, session);
    if (res.status === "matched" && res.record?._id) {
      target.batchId = res.record._id;
      if (!target.batchAssigned) target.batchAssigned = res.record.batchName;
      if (!target.batch) target.batch = res.record.batchName;
    }
  }

  // 6. Course <-> Courses standardization
  if (Array.isArray(target.courses) && target.courses.length > 0) {
    target.courses = target.courses.map((c: any) => String(c).trim()).filter(Boolean);
    if (!target.course && target.courses.length > 0) {
      target.course = target.courses.join(", ");
    }
  } else if (target.course && typeof target.course === "string" && target.course.trim()) {
    const parsed = target.course.split(",").map((c: string) => c.trim()).filter(Boolean);
    target.courses = parsed.length > 0 ? parsed : [target.course.trim()];
  }
}

/**
 * Dual-write synchronization for Enquiry documents and update payloads.
 */
export async function syncEnquiryRefs(
  target: any,
  session?: mongoose.ClientSession | null
): Promise<void> {
  if (!target) return;

  // 1. TargetBrand <-> TargetBrandId
  if (target.targetBrandId) {
    if (!target.targetBrand) {
      const res = await lookupBrand(target.targetBrandId, session);
      if (res.status === "matched" && res.record?.name) {
        target.targetBrand = res.record.name;
      }
    }
  } else if (target.targetBrand) {
    const res = await lookupBrand(target.targetBrand, session);
    if (res.status === "matched" && res.record?._id) {
      target.targetBrandId = res.record._id;
    }
  }

  // 2. AssignedCrmAdvisor <-> AssignedCrmAdvisorId
  if (target.assignedCrmAdvisorId) {
    if (!target.assignedCrmAdvisor) {
      const res = await lookupUser(target.assignedCrmAdvisorId, session);
      if (res.status === "matched" && res.record?.name) {
        target.assignedCrmAdvisor = res.record.name;
      }
    }
  } else if (target.assignedCrmAdvisor) {
    const res = await lookupUser(target.assignedCrmAdvisor, session);
    if (res.status === "matched" && res.record?._id) {
      target.assignedCrmAdvisorId = res.record._id;
    }
  }

  // 3. Course <-> Courses standardization
  if (Array.isArray(target.courses) && target.courses.length > 0) {
    target.courses = target.courses.map((c: any) => String(c).trim()).filter(Boolean);
    if (!target.course && target.courses.length > 0) {
      target.course = target.courses.join(", ");
    }
    if (!target.targetCourse && target.courses.length > 0) {
      target.targetCourse = target.courses.join(", ");
    }
    if (!Array.isArray(target.targetCourses) || target.targetCourses.length === 0) {
      target.targetCourses = target.courses;
    }
  } else if (target.course && typeof target.course === "string" && target.course.trim()) {
    const parsed = target.course.split(",").map((c: string) => c.trim()).filter(Boolean);
    target.courses = parsed.length > 0 ? parsed : [target.course.trim()];
    if (!target.targetCourse) target.targetCourse = target.course;
  } else if (target.targetCourse && typeof target.targetCourse === "string" && target.targetCourse.trim()) {
    const parsed = target.targetCourse.split(",").map((c: string) => c.trim()).filter(Boolean);
    target.courses = parsed.length > 0 ? parsed : [target.targetCourse.trim()];
    if (!target.course) target.course = target.targetCourse;
  }
}

/**
 * Dual-write synchronization for Payment documents and update payloads.
 */
export async function syncPaymentRefs(
  target: any,
  session?: mongoose.ClientSession | null
): Promise<void> {
  if (!target) return;

  // 1. Brand <-> BrandId
  if (target.brandId) {
    if (!target.brand) {
      const res = await lookupBrand(target.brandId, session);
      if (res.status === "matched" && res.record?.name) {
        target.brand = res.record.name;
      }
    }
  } else if (target.brand) {
    const res = await lookupBrand(target.brand, session);
    if (res.status === "matched" && res.record?._id) {
      target.brandId = res.record._id;
    }
  }

  // 2. Company <-> CompanyId
  if (target.companyId) {
    if (!target.company) {
      const res = await lookupCompany(target.companyId, session);
      if (res.status === "matched" && res.record?.name) {
        target.company = res.record.name;
      }
    }
  } else if (target.company) {
    const res = await lookupCompany(target.company, session);
    if (res.status === "matched" && res.record?._id) {
      target.companyId = res.record._id;
    }
  }
}

/**
 * Dual-write synchronization for Expense documents and update payloads.
 */
export async function syncExpenseRefs(
  target: any,
  session?: mongoose.ClientSession | null
): Promise<void> {
  if (!target) return;

  // 1. Brand <-> BrandId
  if (target.brandId) {
    if (!target.brand) {
      const res = await lookupBrand(target.brandId, session);
      if (res.status === "matched" && res.record?.name) {
        target.brand = res.record.name;
      }
    }
  } else if (target.brand) {
    const res = await lookupBrand(target.brand, session);
    if (res.status === "matched" && res.record?._id) {
      target.brandId = res.record._id;
    }
  }

  // 2. Company <-> CompanyId
  if (target.companyId) {
    if (!target.company) {
      const res = await lookupCompany(target.companyId, session);
      if (res.status === "matched" && res.record?.name) {
        target.company = res.record.name;
      }
    }
  } else if (target.company) {
    const res = await lookupCompany(target.company, session);
    if (res.status === "matched" && res.record?._id) {
      target.companyId = res.record._id;
    }
  }
}

/**
 * Dual-write synchronization for Batch documents and update payloads.
 */
export async function syncBatchRefs(
  target: any,
  session?: mongoose.ClientSession | null
): Promise<void> {
  if (!target) return;

  // Brand <-> BrandId
  if (target.brandId) {
    if (!target.brand) {
      const res = await lookupBrand(target.brandId, session);
      if (res.status === "matched" && res.record?.name) {
        target.brand = res.record.name;
      }
    }
  } else if (target.brand) {
    const res = await lookupBrand(target.brand, session);
    if (res.status === "matched" && res.record?._id) {
      target.brandId = res.record._id;
    }
  }
}

/**
 * Dual-write synchronization for Course documents and update payloads.
 */
export async function syncCourseRefs(
  target: any,
  session?: mongoose.ClientSession | null
): Promise<void> {
  if (!target) return;

  // Brand <-> BrandId
  if (target.brandId) {
    if (!target.brand) {
      const res = await lookupBrand(target.brandId, session);
      if (res.status === "matched" && res.record?.name) {
        target.brand = res.record.name;
      }
    }
  } else if (target.brand) {
    const res = await lookupBrand(target.brand, session);
    if (res.status === "matched" && res.record?._id) {
      target.brandId = res.record._id;
    }
  }
}
