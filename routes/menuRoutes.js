import { Router } from "express";
import { body, query } from "express-validator";
import MenuItem from "../models/MenuItem.js";
import { protect, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// GET /api/menu?category=main&dietary=vegan&search=pasta&maxPrice=20
// Public - customers browse without logging in.
router.get(
  "/",
  [
    query("category").optional().isIn(["starter", "main", "dessert", "beverage"]),
    query("maxPrice").optional().isFloat({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { category, dietary, search, maxPrice } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (dietary) filter.dietaryInfo = dietary;
    if (maxPrice) filter.price = { $lte: Number(maxPrice) };
    if (search) filter.$text = { $search: search };

    // Admins can see unavailable items too (for management); customers only see available ones
    if (!req.query.includeUnavailable) filter.isAvailable = true;

    const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    res.json(items);
  })
);

// GET /api/menu/:id
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Menu item not found" });
    res.json(item);
  })
);

const menuItemValidators = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("category").isIn(["starter", "main", "dessert", "beverage"]),
  body("price").isFloat({ min: 0 }).withMessage("Price must be a positive number"),
  body("description").optional().isString(),
  body("ingredients").optional().isArray(),
  body("dietaryInfo").optional().isArray(),
];

// POST /api/menu - admin only
router.post(
  "/",
  protect,
  requireRole("admin"),
  menuItemValidators,
  validate,
  asyncHandler(async (req, res) => {
    const item = await MenuItem.create(req.body);
    res.status(201).json(item);
  })
);

// PUT /api/menu/:id - admin only
router.put(
  "/:id",
  protect,
  requireRole("admin"),
  menuItemValidators.map((v) => v.optional()),
  validate,
  asyncHandler(async (req, res) => {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ message: "Menu item not found" });
    res.json(item);
  })
);

// DELETE /api/menu/:id - admin only
router.delete(
  "/:id",
  protect,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Menu item not found" });
    res.json({ message: "Menu item deleted" });
  })
);

export default router;