import { Router } from "express"
import type { WebSocketService } from "../services/websocket.service"
import { authenticate } from "../middleware/auth.middleware"
import { logger } from "../config/logger"

const router = Router()

let wsService: WebSocketService | null = null

export function initializeWebSocketRoutes(service: WebSocketService): Router {
  wsService = service

  // 获取在线状态
  router.get("/status", authenticate, (req, res) => {
    if (!wsService) {
      return res.status(503).json({ error: "WebSocket service not initialized" })
    }

    res.json({
      online: wsService.getOnlineClientsCount(),
      users: wsService.getOnlineUsers(),
      timestamp: new Date().toISOString(),
    })
  })

  // 发送测试通知
  router.post("/test-notification", authenticate, (req, res) => {
    if (!wsService) {
      return res.status(503).json({ error: "WebSocket service not initialized" })
    }

    const { userId, title, message, type = "info", priority = "medium" } = req.body

    wsService.sendNotificationToUser(userId, {
      id: `test-${Date.now()}`,
      title: title || "Test Notification",
      message: message || "This is a test notification",
      type,
      priority,
    })

    // 如果需要记录发送者信息，可以在日志中记录
    if (req.user) {
      logger.debug("Notification sent by user", { userId: req.user.userId, recipientId: userId })
    }

    res.json({ success: true, message: "Notification sent" })
  })

  return router
}

export default router
