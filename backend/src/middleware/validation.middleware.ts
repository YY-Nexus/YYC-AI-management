import type { Request, Response, NextFunction } from "express"
import type { Schema } from "joi"
import { logger } from "../config/logger"

export function validateRequest(schema: Schema, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    })

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }))

      logger.warn("Validation error", {
        path: req.path,
        errors,
      })

      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors,
      })
    }

    req[source] = value
    next()
  }
}
