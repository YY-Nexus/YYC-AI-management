import type { Request, Response, NextFunction } from "express"
import { logger } from "../config/logger"

// 模拟用户认证（实际应集成真实的认证服务）
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Missing or invalid authorization header",
      })
    }

    const token = authHeader.substring(7)

    // 实际应该验证 JWT token
    // const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // 模拟用户信息
    const user = {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Admin User",
      email: "admin@yanyu.com",
      role: "admin",
      permissions: [
        "reconciliation:read",
        "reconciliation:write",
        "reconciliation:reconcile",
        "reconciliation:import",
        "reconciliation:export",
        "reconciliation:resolve",
        "tickets:read",
        "tickets:create",
        "tickets:update",
        "tickets:message",
      ],
    }
    ;(req as any).user = user
    next()
  } catch (error) {
    logger.error("Authentication error", error)
    res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    })
  }
}

export function checkPermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user

    if (!user || !user.permissions) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      })
    }

    if (!user.permissions.includes(permission)) {
      logger.warn("Permission denied", {
        userId: user.id,
        permission,
        path: req.path,
      })

      return res.status(403).json({
        success: false,
        error: `Permission denied: ${permission}`,
      })
    }

    next()
  }
}
