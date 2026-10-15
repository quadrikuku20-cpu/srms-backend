import { Router } from "express";
import { body } from "express-validator";
import Reservation from "../models/Reservation.js";
import { protect, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();
const TOTAL_TABLES = 15; // simple fixed floor plan for demo purposes

const reservationValidators = [
  body("date").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Date must be YYYY-MM-DD"),
  body("time").matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage("Time must be HH:mm (24h)"),
  body("partySize").isInt({ min: 1, max: 20 }),
  body("tableNumber").optional().isInt({ min: 1, max: TOTAL_TABLES }),
];

// Reject bookings for dates/times in the past, and outside opening hours (11:00-22:00)
function assertBookingIsSensible(date, time) {
  const when = new Date(`${date}T${time}:00`);
  if (Number.isNaN(when.getTime())) {
    throw Object.assign(new Error("Invalid date/time"), { statusCode: 400 });
  }
  if (when.getTime() < Date.now()) {
    throw Object.assign(new Error("Reservation must be in the future"), { statusCode: 400 });
  }
  const hour = Number(time.split(":")[0]);
  if (hour < 11 || hour >= 22) {
    throw Object.assign(new Error("Reservations are only available between 11:00 and 22:00"), { statusCode: 400 });
  }
}

// POST /api/reservations
router.post(
  "/",
  protect,
  reservationValidators,
  validate,
  asyncHandler(async (req, res) => {
    const { date, time, partySize, specialRequests } = req.body;
    assertBookingIsSensible(date, time);

    // Auto-assign the first free table for that slot if none was requested
    let tableNumber = req.body.tableNumber;
    if (!tableNumber) {
      const booked = await Reservation.find({ date, time, status: { $ne: "cancelled" } }).select("tableNumber");
      const bookedSet = new Set(booked.map((r) => r.tableNumber));
      tableNumber = Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1).find((n) => !bookedSet.has(n));
      if (!tableNumber) {
        return res.status(409).json({ message: "No tables available for that date and time" });
      }
    }

    try {
      const reservation = await Reservation.create({
        customer: req.user.id,
        date,
        time,
        partySize,
        tableNumber,
        specialRequests,
      });
      res.status(201).json(reservation);
    } catch (err) {
      // Unique index catches the race condition where two requests grab the same table
      if (err.code === 11000) {
        return res.status(409).json({ message: "That table is already booked for this date and time" });
      }
      throw err;
    }
  })
);

// GET /api/reservations - admin sees all; customer sees only their own
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const filter = req.user.role === "admin" ? {} : { customer: req.user.id };
    const reservations = await Reservation.find(filter).sort({ date: 1, time: 1 }).populate("customer", "name email");
    res.json(reservations);
  })
);

// PUT /api/reservations/:id - customer updates their own upcoming reservation
router.put(
  "/:id",
  protect,
  reservationValidators.map((v) => v.optional()),
  validate,
  asyncHandler(async (req, res) => {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });
    if (req.user.role !== "admin" && String(reservation.customer) !== req.user.id) {
      return res.status(403).json({ message: "You can only update your own reservation" });
    }

    const { date, time, partySize, tableNumber, specialRequests } = req.body;
    if (date) reservation.date = date;
    if (time) reservation.time = time;
    if (partySize) reservation.partySize = partySize;
    if (tableNumber) reservation.tableNumber = tableNumber;
    if (specialRequests !== undefined) reservation.specialRequests = specialRequests;

    assertBookingIsSensible(reservation.date, reservation.time);

    try {
      await reservation.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: "That table is already booked for this date and time" });
      }
      throw err;
    }
    res.json(reservation);
  })
);

// PUT /api/reservations/:id/status - admin approves/cancels a booking
router.put(
  "/:id/status",
  protect,
  requireRole("admin"),
  [body("status").isIn(["pending", "confirmed", "cancelled"])],
  validate,
  asyncHandler(async (req, res) => {
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });
    res.json(reservation);
  })
);

// DELETE /api/reservations/:id - customer cancels (soft-cancel keeps history)
router.delete(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });
    if (req.user.role !== "admin" && String(reservation.customer) !== req.user.id) {
      return res.status(403).json({ message: "You can only cancel your own reservation" });
    }
    reservation.status = "cancelled";
    await reservation.save();
    res.json({ message: "Reservation cancelled" });
  })
);

export default router;