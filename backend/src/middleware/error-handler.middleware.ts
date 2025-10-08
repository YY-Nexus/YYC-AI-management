import type { Request, Response, NextFunction } from "express"
import { logger } from "../config/logger"

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  })

  // 数据库错误
  if (err.code === "23505") {
    return res.status(409).json({
      success: false,
      error: "Duplicate entry",
    })
  }

  if (err.code === "23503") {
    return res.status(400).json({
      success: false,
      error: "Foreign key constraint violation",
    })
  }

  // 验证错误
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: err.message,
    })
  }

  // 默认错误
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error",
  })
}
