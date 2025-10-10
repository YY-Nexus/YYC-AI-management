"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeWebSocketRoutes = initializeWebSocketRoutes;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
let wsService = null;
function initializeWebSocketRoutes(service) {
    wsService = service;
    // 获取在线状态
    router.get("/status", auth_middleware_1.authenticate, (req, res) => {
        if (!wsService) {
            return res.status(503).json({ error: "WebSocket service not initialized" });
        }
        res.json({
            online: wsService.getOnlineClientsCount(),
            users: wsService.getOnlineUsers(),
            timestamp: new Date().toISOString(),
        });
    });
    // 发送测试通知
    router.post("/test-notification", auth_middleware_1.authenticate, (req, res) => {
        if (!wsService) {
            return res.status(503).json({ error: "WebSocket service not initialized" });
        }
        const { userId, title, message, type = "info", priority = "medium" } = req.body;
        wsService.sendNotificationToUser(userId, {
            id: `test-${Date.now()}`,
            title: title || "Test Notification",
            message: message || "This is a test notification",
            type,
            priority,
        });
        // 如果需要记录发送者信息，可以在日志中记录
        if (req.user) {
            logger_1.logger.debug("Notification sent by user", { userId: req.user.userId, recipientId: userId });
        }
        res.json({ success: true, message: "Notification sent" });
    });
    return router;
}
module.exports = router;
