import mongoose, { Schema } from "mongoose";

const CounterSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

if (mongoose.models && mongoose.models.Counter) {
  delete (mongoose.models as any).Counter;
}

const Counter = mongoose.model("Counter", CounterSchema);

export default Counter;
