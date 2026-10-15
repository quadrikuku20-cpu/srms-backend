import { Router } from "express";
import { body } from "express-validator";
import User from "../models/User.js";
import { protect, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// GET /api/users - admin only, list all users
router.get(
  "/",
  protect,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const users = await User.find().select("-password");
    res.json(users);
  })
);

// GET /api/users/:id - a customer can view only their own profile; admin can view any
router.get(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin" && req.user.id !== req.params.id) {
      return res.status(403).json({ message: "You can only view your own profile" });
    }
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  })
);

// PUT /api/users/:id - update own profile (or admin updates any); email/password change disallowed here
router.put(
  "/:id",
  protect,
  [body("name").optional().trim().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin" && req.user.id !== req.params.id) {
      return res.status(403).json({ message: "You can only update your own profile" });
    }

    const { name, preferences } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (preferences !== undefined) update.preferences = preferences;

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  })
);

// DELETE /api/users/:id - admin only
router.delete(
  "/:id",
  protect,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  })
);

export default router;