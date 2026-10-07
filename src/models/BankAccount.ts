import mongoose, { Schema } from "mongoose";
import { encryptField } from "@/lib/encryption";
import { softDeletePlugin } from "@/lib/softDeletePlugin";

/**
 * Bank accounts money is received into. Each account belongs to one company, so receipts
 * entered against an account can be reported bank-wise and company-wise.
 */
const BankAccountSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company is required"],
      index: true,
    },
    // Short name staff pick from in receipt entry, e.g. "Main current account"
    label: {
      type: String,
      required: [true, "Account label is required"],
      trim: true,
    },
    bankName: {
      type: String,
      required: [true, "Bank name is required"],
      trim: true,
    },
    accountHolderName: {
      type: String,
      default: "",
      trim: true,
    },
    // Encrypted at rest and never returned by default; screens show accountLast4 only
    accountNumber: {
      type: String,
      default: "",
      select: false,
    },
    accountLast4: {
      type: String,
      default: "",
    },
    ifsc: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },
    branch: {
      type: String,
      default: "",
      trim: true,
    },
    accountType: {
      type: String,
      enum: ["CURRENT", "SAVINGS", "OD_CC", "OTHER"],
      default: "CURRENT",
    },
    upiId: {
      type: String,
      default: "",
      trim: true,
    },
    // Whether money received here is GST-billed income (used by the GST / Non-GST split in reports)
    gstApplicable: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
  },
  { timestamps: true }
);

BankAccountSchema.index({ companyId: 1, status: 1 });

function prepareAccountNumber(target: any) {
  const raw = target?.accountNumber;
  if (typeof raw !== "string" || !raw.trim() || raw.startsWith("enc:")) return;
  const digits = raw.replace(/\s+/g, "");
  target.accountLast4 = digits.slice(-4);
  target.accountNumber = encryptField(digits) || digits;
}

BankAccountSchema.pre("save", function () {
  if (this.isModified("accountNumber")) prepareAccountNumber(this);
});

BankAccountSchema.pre(["findOneAndUpdate", "updateOne"], function () {
  const update = this.getUpdate() as any;
  if (update) prepareAccountNumber(update.$set || update);
});

BankAccountSchema.plugin(softDeletePlugin);

delete (mongoose.models as any).BankAccount;
const BankAccount = mongoose.model("BankAccount", BankAccountSchema);

export default BankAccount;
