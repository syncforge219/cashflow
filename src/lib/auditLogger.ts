import mongoose from "mongoose";
import AuditLog, { type IAuditChange, type IAuditLog } from "@/models/AuditLog";
import { getContextUserId } from "./requestContext";

/**
 * Fields requiring audit logging per requirements:
 * - Names
 * - Phone numbers
 * - Fees
 * - Discounts
 * - Discount approvals
 * - Payments
 * - Company assignment
 */
export const AUDITED_FIELDS = {
  names: [
    "fullName",
    "name",
    "studentName",
    "studentFullName",
    "parentsFullName",
    "parentName",
    "fatherName",
    "motherName",
    "applicantName",
    "clientName",
    "employeeName",
    "customerName",
    "contactPerson",
  ],
  phones: [
    "phone",
    "phoneNumber",
    "mobileNumber",
    "primaryPhoneMobile",
    "parentsPhoneNumber",
    "parentPhone",
    "mobile",
    "contactNumber",
    "whatsappNumber",
    "studentPhone",
  ],
  fees: [
    "finalFee",
    "totalFee",
    "baseFee",
    "courseFee",
    "actualAdmissionFee",
    "fee",
    "amount",
    "finalFeePaise",
    "totalFeePaise",
    "courseFeePaise",
    "baseSalary",
    "netSalary",
  ],
  discounts: [
    "discount",
    "discountPercent",
    "discountAmount",
    "discountPaise",
    "discountAmountPaise",
    "specialDiscount",
  ],
  discountApprovals: [
    "discountApproved",
    "discountApprovalStatus",
    "discountApprovedBy",
    "discountApprovalRemarks",
    "isDiscountApproved",
  ],
  payments: [
    "amountReceived",
    "amountReceivedPaise",
    "paymentMode",
    "remainingBalance",
    "remainingBalancePaise",
    "status",
    "paymentDate",
    "transactionId",
  ],
  companyAssignment: [
    "company",
    "companyAssigned",
    "companyId",
    "brand",
    "brandId",
    "targetBrandId",
    "targetBrand",
  ],
};

const ALL_WATCHED_FIELDS = new Set<string>([
  ...AUDITED_FIELDS.names,
  ...AUDITED_FIELDS.phones,
  ...AUDITED_FIELDS.fees,
  ...AUDITED_FIELDS.discounts,
  ...AUDITED_FIELDS.discountApprovals,
  ...AUDITED_FIELDS.payments,
  ...AUDITED_FIELDS.companyAssignment,
]);

export interface LogAuditEntryParams {
  collectionName: string;
  docId: any;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "SOFT_DELETE" | string;
  changedFields: IAuditChange[];
  userId?: any;
  at?: Date;
}

/**
 * Writes an entry to the audit_logs collection.
 */
export async function logAuditEntry(params: LogAuditEntryParams): Promise<IAuditLog | null> {
  try {
    const { collectionName, docId, action, changedFields, at } = params;

    let resolvedUserId: mongoose.Types.ObjectId | null = null;
    const rawUserId = params.userId || getContextUserId();
    if (rawUserId) {
      if (rawUserId instanceof mongoose.Types.ObjectId) {
        resolvedUserId = rawUserId;
      } else if (mongoose.Types.ObjectId.isValid(String(rawUserId))) {
        resolvedUserId = new mongoose.Types.ObjectId(String(rawUserId));
      }
    }

    const log = await AuditLog.create({
      collection: collectionName,
      docId: docId ? String(docId) : "unknown",
      action,
      changedFields: changedFields.map((cf) => ({
        field: cf.field,
        oldValue: cf.oldValue !== undefined ? cf.oldValue : null,
        newValue: cf.newValue !== undefined ? cf.newValue : null,
      })),
      userId: resolvedUserId,
      at: at || new Date(),
    });

    return log;
  } catch (error) {
    console.error("Failed to write audit log entry:", error);
    return null;
  }
}

/**
 * Diffs old and new object states for watched fields and writes an audit log if differences exist.
 */
export async function diffAndLogAudit(params: {
  collectionName: string;
  docId: any;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "SOFT_DELETE" | string;
  oldDoc?: any;
  newDoc?: any;
  userId?: any;
  customWatchedFields?: string[];
}): Promise<IAuditLog | null> {
  const { collectionName, docId, action, oldDoc = {}, newDoc = {}, userId, customWatchedFields } = params;
  const fieldsToCheck = customWatchedFields ? new Set(customWatchedFields) : ALL_WATCHED_FIELDS;
  const changedFields: IAuditChange[] = [];

  for (const field of fieldsToCheck) {
    const oldVal = oldDoc[field];
    const newVal = newDoc[field];

    if (newVal === undefined && oldVal === undefined) continue;

    // Normalization for comparison
    const normOld = oldVal instanceof mongoose.Types.ObjectId ? oldVal.toString() : oldVal;
    const normNew = newVal instanceof mongoose.Types.ObjectId ? newVal.toString() : newVal;

    const hasChanged =
      (normOld === undefined || normOld === null ? "" : String(normOld).trim()) !==
      (normNew === undefined || normNew === null ? "" : String(normNew).trim());

    if (hasChanged) {
      changedFields.push({
        field,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  if (changedFields.length === 0 && action === "UPDATE") {
    return null;
  }

  return await logAuditEntry({
    collectionName,
    docId,
    action,
    changedFields,
    userId,
  });
}
