import { Schema } from "mongoose";

/**
 * Pieces shared by ServicePI and ServiceInvoice.
 * Company and client details are copied onto each document when it is created, so a later
 * change to the masters never alters a PI or invoice that was already issued.
 */

export const CompanySnapshotSchema = new Schema(
  {
    name: { type: String, default: "" },
    legalName: { type: String, default: "" },
    gstin: { type: String, default: "" },
    pan: { type: String, default: "" },
    address: { type: String, default: "" },
    stateCode: { type: String, default: "" },
    gstType: { type: String, enum: ["GST", "NON_GST"], required: true },
  },
  { _id: false }
);

export const ClientSnapshotSchema = new Schema(
  {
    name: { type: String, default: "" },
    gstin: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    stateCode: { type: String, default: "" },
    pincode: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
  },
  { _id: false }
);

/** All money in integer paise. */
export const amountFields = {
  taxMode: { type: String, enum: ["CGST_SGST", "IGST", "NONE"], required: true },
  basePaise: { type: Number, required: true, min: 0 },
  cgstRate: { type: Number, default: 0 },
  sgstRate: { type: Number, default: 0 },
  igstRate: { type: Number, default: 0 },
  cgstPaise: { type: Number, default: 0 },
  sgstPaise: { type: Number, default: 0 },
  igstPaise: { type: Number, default: 0 },
  taxPaise: { type: Number, default: 0 },
  totalPaise: { type: Number, required: true, min: 0 },
};

export const BUSINESS_TYPE_ENUM = ["DIGITAL_MARKETING", "TRAINING", "BOOKS_MATERIAL"];
