import { Router } from "express"
import type { WebSocketService } from "../services/websocket.service"
import { authenticateToken } from "../middleware/auth.middleware"

const router = Router()

let wsService: WebSocketService | null = null

export function initializeWebSocketRoutes(service: WebSocketService): Router {
  wsService = service

  // 获取在线状态
  router.get("/status", authenticateToken, (req, res) => {
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
  router.post("/test-notification", authenticateToken, (req, res) => {
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
      metadata: {
        timestamp: new Date().toISOString(),
        sentBy: req.user.userId,
      },
    })

    res.json({ success: true, message: "Notification sent" })
  })

  return router
}

export default router
