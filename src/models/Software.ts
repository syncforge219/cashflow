import mongoose, { Schema } from "mongoose";

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

if (mongoose.models && mongoose.models.Software) {
  delete (mongoose.models as any).Software;
}

const Software = mongoose.model("Software", SoftwareSchema);

export default Software;
