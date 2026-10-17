export function notFoundHandler(req, _res, next) {
  next({ statusCode: 404, message: `Route not found: ${req.originalUrl}` });
}