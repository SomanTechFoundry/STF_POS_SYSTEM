export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";
  if (statusCode >= 500) {
    console.error("[error]", {
      statusCode,
      message,
      details: err.details || null,
      code: err.code || null
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    details: err.details || null
  });
}
