import mongoose, { Schema } from "mongoose";

const OfficeLocationSchema = new Schema(
  {
    latitude: {
      type: Number,
      required: [true, "Latitude is required"],
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required"],
    },
    radiusMeters: {
      type: Number,
      default: 200, // Default allowed attendance distance in meters
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    brand: {
      type: String,
      trim: true,
      default: "All",
    },
    updatedBy: {
      type: String,
      trim: true,
      default: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

OfficeLocationSchema.index({ brand: 1 });

if (mongoose.models && mongoose.models.OfficeLocation) {
  delete (mongoose.models as any).OfficeLocation;
}

const OfficeLocation = mongoose.model("OfficeLocation", OfficeLocationSchema);

export default OfficeLocation;
