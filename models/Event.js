import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    eventType: {
      type: String,
      enum: ["birthday", "corporate", "anniversary", "other"],
      required: true,
    },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // HH:mm
    guestCount: { type: Number, required: true, min: 1 },
    menuSelection: [{ type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" }],
    additionalRequirements: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);