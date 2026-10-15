// Central error handler. Any next(err) or thrown error in an async route
// (wrapped by asyncHandler) ends up here instead of crashing the process.
export function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 11000) {
    // Mongo duplicate key, e.g. double-booking a table or reusing an email
    const field = Object.keys(err.keyPattern || {}).join(", ");
    return res.status(409).json({ message: `Duplicate value for: ${field}` });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: `Invalid id: ${err.value}` });
  }

  res.status(err.statusCode || 500).json({
    message: err.message || "Internal server error",
  });
}

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Wraps an async route handler so rejected promises reach errorHandler
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}