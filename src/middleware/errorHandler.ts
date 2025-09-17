import { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
  status?: number;
  details?: any;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("❌ Error:", err);

  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  return res.status(status).json({
    success: false,
    message,
    details: err.details || null,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
}

export function createError(
  status: number,
  message: string,
  details?: any
): ApiError {
  const error: ApiError = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}
