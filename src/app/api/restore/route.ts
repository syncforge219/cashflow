import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { getUserFromCookies } from "@/lib/helper";
import { logAuditEntry } from "@/lib/auditLogger";

import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Quotation from "@/models/Quotation";
import ProformaInvoice from "@/models/ProformaInvoice";
import PurchaseOrder from "@/models/PurchaseOrder";
import Expense from "@/models/Expense";
import Payroll from "@/models/Payroll";

const MODEL_MAP: Record<string, any> = {
  enquiry: Enquiry,
  enquiries: Enquiry,
  admission: Admission,
  admissions: Admission,
  payment: Payment,
  payments: Payment,
  quotation: Quotation,
  quotations: Quotation,
  proformainvoice: ProformaInvoice,
  proforma_invoice: ProformaInvoice,
  "proforma-invoice": ProformaInvoice,
  "proforma-invoices": ProformaInvoice,
  proforma_invoices: ProformaInvoice,
  purchaseorder: PurchaseOrder,
  purchase_order: PurchaseOrder,
  "purchase-order": PurchaseOrder,
  "purchase-orders": PurchaseOrder,
  purchase_orders: PurchaseOrder,
  expense: Expense,
  expenses: Expense,
  payroll: Payroll,
};

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userRole = (user.role || "").toLowerCase().trim();
    const isSuperAdmin = userRole === "super admin" || userRole === "super_admin";

    if (!isSuperAdmin) {
      return NextResponse.json(
        { success: false, message: "Forbidden: Only Super Admin can view or restore deleted records." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);

    const collectionName = (body.collection || body.model || searchParams.get("collection") || searchParams.get("model") || "").toLowerCase().trim();
    const id = body.id || body._id || searchParams.get("id");

    if (!collectionName || !id) {
      return NextResponse.json(
        { success: false, message: "Both 'collection' and 'id' are required to restore a record." },
        { status: 400 }
      );
    }

    const Model = MODEL_MAP[collectionName];
    if (!Model) {
      return NextResponse.json(
        { success: false, message: `Unsupported collection '${collectionName}'.` },
        { status: 400 }
      );
    }

    const doc = await Model.findById(id, null, { includeDeleted: true });
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "Record not found." },
        { status: 404 }
      );
    }

    if (!doc.isDeleted) {
      return NextResponse.json(
        { success: true, message: "Record is not deleted.", data: doc },
        { status: 200 }
      );
    }

    doc.isDeleted = false;
    doc.deletedAt = null;
    doc.deletedBy = null;
    await doc.save();

    // If restoring an Admission, also restore its associated Payments that were deleted
    if (Model === Admission) {
      await Payment.updateMany(
        { admissionId: doc._id, isDeleted: true },
        { $set: { isDeleted: false, deletedAt: null, deletedBy: null } }
      );
    }

    await logAuditEntry({
      collectionName,
      docId: doc._id,
      action: "RESTORE",
      changedFields: [{ field: "isDeleted", oldValue: true, newValue: false }],
      userId: user._id,
    });

    return NextResponse.json({
      success: true,
      message: `Record from '${collectionName}' restored successfully.`,
      data: doc,
    });
  } catch (error: any) {
    console.error("Error restoring record:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to restore record." },
      { status: 500 }
    );
  }
}
