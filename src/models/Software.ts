import mongoose, { Schema } from "mongoose";
import { encryptField } from "@/lib/encryption";

const SoftwareSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Software name is required"],
      trim: true,
    },
    domain: {
      type: String,
      trim: true,
      default: "",
    },
    licenseKey: {
      type: String,
      trim: true,
      select: false,
    },
    techUsed: [
      {
        type: String,
        trim: true,
      },
    ],
    developerNames: [
      {
        type: String,
        trim: true,
      },
    ],
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

// Automatically encrypt licenseKey at rest before save
SoftwareSchema.pre("save", async function () {
  if (this.licenseKey && typeof this.licenseKey === "string") {
    this.licenseKey = encryptField(this.licenseKey) || this.licenseKey;
  }
});

SoftwareSchema.pre(["findOneAndUpdate", "updateOne"], async function () {
  const update = this.getUpdate() as any;
  if (update) {
    const target = update.$set || update;
    if (target.licenseKey && typeof target.licenseKey === "string") {
      target.licenseKey = encryptField(target.licenseKey) || target.licenseKey;
    }
  }
});

if (mongoose.models && mongoose.models.Software) {
  delete (mongoose.models as any).Software;
}

const Software = mongoose.model("Software", SoftwareSchema);

export default Software;
