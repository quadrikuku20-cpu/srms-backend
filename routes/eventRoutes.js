import { Router } from "express";
import { body } from "express-validator";
import Event from "../models/Event.js";
import { protect, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

const eventValidators = [
  body("eventType").isIn(["birthday", "corporate", "anniversary", "other"]),
  body("date").matches(/^\d{4}-\d{2}-\d{2}$/),
  body("time").matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body("guestCount").isInt({ min: 1 }),
];

// POST /api/events
router.post(
  "/",
  protect,
  eventValidators,
  validate,
  asyncHandler(async (req, res) => {
    const { eventType, date, time, guestCount, menuSelection, additionalRequirements } = req.body;
    const event = await Event.create({
      customer: req.user.id,
      eventType,
      date,
      time,
      guestCount,
      menuSelection,
      additionalRequirements,
    });
    res.status(201).json(event);
  })
);

// GET /api/events - admin sees all; customer sees only their own
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const filter = req.user.role === "admin" ? {} : { customer: req.user.id };
    const events = await Event.find(filter)
      .sort({ date: 1 })
      .populate("customer", "name email")
      .populate("menuSelection", "name price");
    res.json(events);
  })
);

// PUT /api/events/:id/status - admin approves/cancels
router.put(
  "/:id/status",
  protect,
  requireRole("admin"),
  [body("status").isIn(["pending", "approved", "cancelled"])],
  validate,
  asyncHandler(async (req, res) => {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  })
);

// DELETE /api/events/:id - customer cancels their own event booking
router.delete(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (req.user.role !== "admin" && String(event.customer) !== req.user.id) {
      return res.status(403).json({ message: "You can only cancel your own event" });
    }
    event.status = "cancelled";
    await event.save();
    res.json({ message: "Event cancelled" });
  })
);

export default router;