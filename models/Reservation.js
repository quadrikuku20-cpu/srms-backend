import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // HH:mm (24h)
    partySize: { type: Number, required: true, min: 1, max: 20 },
    tableNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "confirmed",
    },
    specialRequests: { type: String, default: "" },
  },
  { timestamps: true }
);

// Prevent double-booking the same table on the same date and time.
// Cancelled reservations are left out of the index, so their table can be booked again.
// (MongoDB partial indexes can't use $ne, so the active statuses are listed with $in.)
reservationSchema.index(
  { date: 1, time: 1, tableNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "confirmed"] } },
  }
);

export default mongoose.model("Reservation", reservationSchema);
