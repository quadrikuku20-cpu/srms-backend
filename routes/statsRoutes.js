import { Router } from "express";
import Order from "../models/Order.js";
import Reservation from "../models/Reservation.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { protect, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();
const TZ = "America/Edmonton";
const round2 = (n) => Math.round(n * 100) / 100;

// Calgary-local YYYY-MM-DD for a Date
function calgaryDay(date) {
  return date.toLocaleDateString("sv-SE", { timeZone: TZ });
}

// GET /api/stats - admin only, numbers for the dashboard overview
router.get(
  "/",
  protect,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const today = calgaryDay(new Date());
    const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    const [totals, perDayRaw, topItems, byStatus, upcomingReservations, pendingEvents, customers] =
      await Promise.all([
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" } } },
          { $group: { _id: null, revenue: { $sum: "$totalPrice" }, orders: { $sum: 1 } } },
        ]),
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" }, createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
              orders: { $sum: 1 },
              revenue: { $sum: "$totalPrice" },
            },
          },
        ]),
        Order.aggregate([
          { $match: { status: { $ne: "cancelled" } } },
          { $unwind: "$items" },
          {
            $group: {
              _id: "$items.name",
              quantity: { $sum: "$items.quantity" },
              revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
            },
          },
          { $sort: { quantity: -1 } },
          { $limit: 5 },
        ]),
        Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Reservation.countDocuments({ status: { $ne: "cancelled" }, date: { $gte: today } }),
        Event.countDocuments({ status: "pending" }),
        User.countDocuments({ role: "customer" }),
      ]);

    // Last 7 Calgary days, with zeros for days that had no orders
    const dayMap = new Map(perDayRaw.map((d) => [d._id, d]));
    const perDay = [];
    for (let i = 6; i >= 0; i--) {
      const day = calgaryDay(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
      const found = dayMap.get(day);
      perDay.push({ date: day, orders: found?.orders || 0, revenue: round2(found?.revenue || 0) });
    }

    const revenue = totals[0]?.revenue || 0;
    const orders = totals[0]?.orders || 0;

    res.json({
      revenue: round2(revenue),
      orders,
      avgOrderValue: orders ? round2(revenue / orders) : 0,
      ordersByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
      upcomingReservations,
      pendingEvents,
      customers,
      perDay,
      topItems: topItems.map((t) => ({ name: t._id, quantity: t.quantity, revenue: round2(t.revenue) })),
    });
  })
);

export default router;
