// Wraps async Express handlers so rejected promises reach the error middleware
// (Express 4 does not catch async errors automatically).
export function ah(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
