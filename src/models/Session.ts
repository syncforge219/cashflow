import mongoose, { Schema } from "mongoose";

const SessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    token: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    autoIndex: process.env.NODE_ENV !== "production",
  }
);

// TTL index on expiresAt: automatically expires sessions when expiresAt is reached
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

if (mongoose.models && mongoose.models.Session) {
  delete (mongoose.models as any).Session;
}

const Session = mongoose.model("Session", SessionSchema);

export default Session;
