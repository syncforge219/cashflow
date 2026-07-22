import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, "Please enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    role: {
      type: String,
      enum: ["super admin", "brand manager", "counsellor", "teacher"],
      default: "super admin",
    },
    subjects: [
      {
        type: String,
        trim: true,
      },
    ],
    subject: {
      type: Schema.Types.Mixed,
    },
    // Counsellor-specific fields (only populated when role is "counsellor")
    phone: {
      type: String,
      trim: true,
    },
    photoUrl: {
      type: String,
      trim: true,
    },
    brandLogo: {
      type: String,
      trim: true,
    },
    brandScope: {
      type: String,
      trim: true,
    },
    joiningDate: {
      type: Date,
    },
    annualTarget: {
      type: Number,
      default: 0,
    },
    currentRevenue: {
      type: Number,
      default: 0,
    },
    admissionsRecorded: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

if (mongoose.models && mongoose.models.User) {
  delete (mongoose.models as any).User;
}

const User = mongoose.models.User || mongoose.model("User", UserSchema);

export default User;
