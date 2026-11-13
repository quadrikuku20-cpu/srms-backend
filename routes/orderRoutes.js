import { Router } from "express";
import { body } from "express-validator";
import Order from "../models/Order.js";
import MenuItem from "../models/MenuItem.js";
import User from "../models/User.js";
import { protect, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// Prices a list of { menuItem, quantity } from the database - never trust prices sent by the client.
// The same dish listed twice is merged into one line.
async function priceItems(items) {
  const quantities = new Map();
  for (const i of items) {
    const id = String(i.menuItem);
    quantities.set(id, (quantities.get(id) || 0) + Number(i.quantity));
  }

  const menuItems = await MenuItem.find({ _id: { $in: [...quantities.keys()] } });
  const menuMap = new Map(menuItems.map((m) => [String(m._id), m]));

  let totalPrice = 0;
  const orderItems = [];
  for (const [id, quantity] of quantities) {
    const menuItem = menuMap.get(id);
    if (!menuItem) throw Object.assign(new Error(`Menu item ${id} not found`), { statusCode: 400 });
    if (!menuItem.isAvailable) throw Object.assign(new Error(`${menuItem.name} is currently unavailable`), { statusCode: 400 });
    totalPrice += menuItem.price * quantity;
    orderItems.push({ menuItem: menuItem._id, name: menuItem.name, price: menuItem.price, quantity });
  }
  return { orderItems, totalPrice: Math.round(totalPrice * 100) / 100 };
}

// POST /api/orders - customer creates an order from cart items
router.post(
  "/",
  protect,
  [
    body("items").isArray({ min: 1 }).withMessage("Order must contain at least one item"),
    body("items.*.menuItem").isMongoId(),
    body("items.*.quantity").isInt({ min: 1 }),
    body("fulfillmentType").isIn(["delivery", "pickup"]),
    body("deliveryAddress").if(body("fulfillmentType").equals("delivery")).notEmpty(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { items, fulfillmentType, deliveryAddress, notes } = req.body;

    // Re-price server-side from the DB (see priceItems above)
    const { orderItems, totalPrice } = await priceItems(items);

    const order = await Order.create({
      customer: req.user.id,
      items: orderItems,
      fulfillmentType,
      deliveryAddress,
      totalPrice: Math.round(totalPrice * 100) / 100,
      notes,
    });

    await User.findByIdAndUpdate(req.user.id, { $push: { orderHistory: order._id } });

    res.status(201).json(order);
  })
);

// GET /api/orders - admin sees all orders; customer sees only their own
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const filter = req.user.role === "admin" ? {} : { customer: req.user.id };
    const orders = await Order.find(filter).sort({ createdAt: -1 }).populate("customer", "name email");
    res.json(orders);
  })
);

// GET /api/orders/:id
router.get(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate("customer", "name email");
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (req.user.role !== "admin" && String(order.customer._id) !== req.user.id) {
      return res.status(403).json({ message: "You can only view your own orders" });
    }
    res.json(order);
  })
);

// PUT /api/orders/:id - the owner (or an admin) edits an order that is still pending
router.put(
  "/:id",
  protect,
  [
    body("items").optional().isArray({ min: 1 }).withMessage("Order must contain at least one item"),
    body("items.*.menuItem").isMongoId(),
    body("items.*.quantity").isInt({ min: 1, max: 99 }),
    body("fulfillmentType").optional().isIn(["delivery", "pickup"]),
    body("deliveryAddress").optional({ nullable: true }).isString().trim(),
    body("notes").optional().isString().trim().isLength({ max: 300 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (req.user.role !== "admin" && String(order.customer) !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your own orders" });
    }
    if (order.status !== "pending") {
      return res.status(400).json({ message: `Only pending orders can be edited (this one is ${order.status}).` });
    }

    const { items, fulfillmentType, deliveryAddress, notes } = req.body;

    if (items) {
      const { orderItems, totalPrice } = await priceItems(items);
      order.items = orderItems;
      order.totalPrice = totalPrice;
    }
    if (fulfillmentType) order.fulfillmentType = fulfillmentType;
    if (deliveryAddress !== undefined) order.deliveryAddress = deliveryAddress;
    if (notes !== undefined) order.notes = notes;

    if (order.fulfillmentType === "delivery" && !String(order.deliveryAddress || "").trim()) {
      return res.status(400).json({ message: "A delivery address is required for delivery orders" });
    }
    if (order.fulfillmentType === "pickup") order.deliveryAddress = undefined;

    await order.save();
    res.json(order);
  })
);
// PUT /api/orders/:id/status - admin only, moves order through its lifecycle
router.put(
  "/:id/status",
  protect,
  requireRole("admin"),
  [body("status").isIn(["pending", "preparing", "ready", "delivered", "cancelled"])],
  validate,
  asyncHandler(async (req, res) => {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  })
);

// PUT /api/orders/:id/cancel - customer can cancel their own pending order
router.put(
  "/:id/cancel",
  protect,
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (req.user.role !== "admin" && String(order.customer) !== req.user.id) {
      return res.status(403).json({ message: "You can only cancel your own orders" });
    }
    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({ message: `Order already ${order.status}, cannot cancel` });
    }
    if (req.user.role !== "admin" && order.status !== "pending") {
      return res.status(400).json({ message: "Only pending orders can be cancelled. Please contact the restaurant." });
    }
    order.status = "cancelled";
    await order.save();
    res.json(order);
  })
);

export default router;