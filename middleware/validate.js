import { validationResult } from "express-validator";

// Runs after express-validator check(...) middlewares; short-circuits with 400 on failure.
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }
  next();
}