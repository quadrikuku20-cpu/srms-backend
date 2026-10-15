import { Router } from "express";
import { body } from "express-validator";
import Order from "../models/Order.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { matchChatbotResponse } from "../data/chatbotResponses.js";

const router = Router();

// POST /api/chatbot - works for guests (generic answers) and logged-in
// customers (personalized "what did I order last time" answers).
router.post(
  "/",
  [body("message").trim().notEmpty().withMessage("Message is required")],
  validate,
  asyncHandler(async (req, res) => {
    let lastOrderSummary = null;

    // If a valid token was sent, look up their real last order; otherwise answer generically.
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ") && req.user === undefined) {
      // lightweight optional-auth: try to decode without failing the whole request
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
        const lastOrder = await Order.findOne({ customer: decoded.id }).sort({ createdAt: -1 });
        if (lastOrder) {
          lastOrderSummary = lastOrder.items.map((i) => i.name).join(" and ");
        }
      } catch {
        // invalid/expired token - just fall back to the generic dataset response
      }
    }

    const response = matchChatbotResponse(req.body.message, { lastOrderSummary });
    res.json({ response });
  })
);

export default router;