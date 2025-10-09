"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const jwt = __importStar(require("jsonwebtoken"));
const logger_1 = require("../config/logger");
const redis_1 = require("../config/redis");
class WebSocketService {
    constructor(httpServer) {
        this.clients = new Map();
        this.heartbeatInterval = null;
        this.HEARTBEAT_INTERVAL = 30000; // 30 seconds
        this.CLIENT_TIMEOUT = 60000; // 60 seconds
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_BASE_URL || "http://localhost:3000",
                methods: ["GET", "POST"],
                credentials: true,
            },
            transports: ["websocket", "polling"],
            pingTimeout: 60000,
            pingInterval: 25000,
        });
        this.setupMiddleware();
        this.setupEventHandlers();
        this.startHeartbeatMonitor();
    }
    /**
     * 设置认证中间件
     */
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
                if (!token) {
                    logger_1.logger.warn("WebSocket connection rejected: No token provided", { socketId: socket.id });
                    return next(new Error("Authentication required"));
                }
                // 验证 JWT token
                const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
                // 检查 Redis 中的 token 黑名单
                const isBlacklisted = await redis_1.redis.get(`blacklist:${token}`);
                if (isBlacklisted) {
                    logger_1.logger.warn("WebSocket connection rejected: Token blacklisted", {
                        socketId: socket.id,
                        userId: decoded.userId,
                    });
                    return next(new Error("Token is invalid"));
                }
                // 将用户信息附加到 socket
                socket.data.userId = decoded.userId;
                socket.data.username = decoded.username;
                socket.data.roles = decoded.roles || [];
                socket.data.departments = decoded.departments || [];
                logger_1.logger.info("WebSocket authentication successful", {
                    socketId: socket.id,
                    userId: decoded.userId,
                    username: decoded.username,
                });
                next();
            }
            catch (error) {
                logger_1.logger.error("WebSocket authentication failed", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    socketId: socket.id,
                });
                next(new Error("Authentication failed"));
            }
        });
    }
    /**
     * 设置事件处理器
     */
    setupEventHandlers() {
        this.io.on("connection", (socket) => {
            this.handleConnection(socket);
        });
    }
    /**
     * 处理新连接
     */
    handleConnection(socket) {
        const client = {
            id: socket.id,
            userId: socket.data.userId,
            roles: socket.data.roles,
            departments: socket.data.departments,
            connectedAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
        };
        this.clients.set(socket.id, client);
        logger_1.logger.info("WebSocket client connected", {
            socketId: socket.id,
            userId: client.userId,
            totalClients: this.clients.size,
        });
        // 将客户端加入用户专属房间
        socket.join(`user:${client.userId}`);
        // 根据角色加入房间
        client.roles.forEach((role) => {
            socket.join(`role:${role}`);
        });
        // 根据部门加入房间
        client.departments.forEach((dept) => {
            socket.join(`department:${dept}`);
        });
        // 发送欢迎消息
        socket.emit("connected", {
            message: "Connected to YanYu Cloud³",
            clientId: socket.id,
            timestamp: new Date().toISOString(),
        });
        // 心跳处理
        socket.on("heartbeat", (data) => {
            this.handleHeartbeat(socket.id, data);
        });
        // 订阅频道
        socket.on("subscribe", (data) => {
            this.handleSubscribe(socket, data);
        });
        // 取消订阅
        socket.on("unsubscribe", (data) => {
            this.handleUnsubscribe(socket, data);
        });
        // 断开连接
        socket.on("disconnect", (reason) => {
            this.handleDisconnect(socket, reason);
        });
        // 错误处理
        socket.on("error", (error) => {
            logger_1.logger.error("WebSocket error", {
                socketId: socket.id,
                userId: client.userId,
                error: error.message,
            });
        });
    }
    /**
     * 处理心跳
     */
    handleHeartbeat(socketId, data) {
        const client = this.clients.get(socketId);
        if (client) {
            client.lastHeartbeat = new Date().toISOString();
            this.clients.set(socketId, client);
            // 返回心跳响应
            this.io.to(socketId).emit("heartbeat_ack", {
                timestamp: new Date().toISOString(),
            });
        }
    }
    /**
     * 处理订阅
     */
    handleSubscribe(socket, data) {
        const client = this.clients.get(socket.id);
        if (!client)
            return;
        data.channels.forEach((channel) => {
            // RBAC 权限检查
            if (this.hasChannelPermission(client, channel)) {
                socket.join(channel);
                logger_1.logger.info("Client subscribed to channel", {
                    socketId: socket.id,
                    userId: client.userId,
                    channel,
                });
            }
            else {
                logger_1.logger.warn("Client denied subscription to channel", {
                    socketId: socket.id,
                    userId: client.userId,
                    channel,
                });
                socket.emit("subscription_error", {
                    channel,
                    message: "Permission denied",
                });
            }
        });
        socket.emit("subscribed", {
            channels: data.channels,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * 处理取消订阅
     */
    handleUnsubscribe(socket, data) {
        data.channels.forEach((channel) => {
            socket.leave(channel);
            logger_1.logger.info("Client unsubscribed from channel", {
                socketId: socket.id,
                channel,
            });
        });
        socket.emit("unsubscribed", {
            channels: data.channels,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * 处理断开连接
     */
    handleDisconnect(socket, reason) {
        const client = this.clients.get(socket.id);
        if (client) {
            logger_1.logger.info("WebSocket client disconnected", {
                socketId: socket.id,
                userId: client.userId,
                reason,
                duration: Date.now() - new Date(client.connectedAt).getTime(),
            });
            this.clients.delete(socket.id);
        }
    }
    /**
     * 启动心跳监控
     */
    startHeartbeatMonitor() {
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            const timeoutClients = [];
            this.clients.forEach((client, socketId) => {
                const lastHeartbeat = new Date(client.lastHeartbeat).getTime();
                if (now - lastHeartbeat > this.CLIENT_TIMEOUT) {
                    timeoutClients.push(socketId);
                }
            });
            // 断开超时的客户端
            timeoutClients.forEach((socketId) => {
                logger_1.logger.warn("Client timeout, disconnecting", { socketId });
                this.io.to(socketId).disconnectSockets();
                this.clients.delete(socketId);
            });
        }, this.HEARTBEAT_INTERVAL);
    }
    /**
     * RBAC 权限检查
     */
    hasChannelPermission(client, channel) {
        // 所有人都可以订阅自己的频道
        if (channel === `user:${client.userId}`) {
            return true;
        }
        // 检查角色权限
        if (channel.startsWith("role:")) {
            const role = channel.replace("role:", "");
            return client.roles.includes(role);
        }
        // 检查部门权限
        if (channel.startsWith("department:")) {
            const dept = channel.replace("department:", "");
            return client.departments.includes(dept);
        }
        // 管理员可以订阅所有频道
        if (client.roles.includes("admin") || client.roles.includes("super_admin")) {
            return true;
        }
        // 默认拒绝
        return false;
    }
    /**
     * 广播工单创建事件
     */
    broadcastTicketCreated(ticket) {
        const message = {
            type: "ticket_created",
            payload: {
                ticketId: ticket.id,
                ticketNumber: ticket.ticketNumber,
                title: ticket.title,
                priority: ticket.priority,
                status: ticket.status,
                createdBy: ticket.createdBy,
                timestamp: new Date().toISOString(),
            },
            timestamp: new Date().toISOString(),
            ticketId: ticket.id,
        };
        // 发送给管理员和客服角色
        this.io.to("role:admin").to("role:support").emit("ticket_created", message);
        logger_1.logger.info("Broadcast ticket created", { ticketId: ticket.id, ticketNumber: ticket.ticketNumber });
    }
    /**
     * 广播工单更新事件
     */
    broadcastTicketUpdated(payload) {
        const message = {
            type: "ticket_updated",
            payload,
            timestamp: new Date().toISOString(),
            ticketId: payload.ticketId,
        };
        // 发送给相关用户
        this.io.to(`ticket:${payload.ticketId}`).emit("ticket_updated", message);
        logger_1.logger.info("Broadcast ticket updated", {
            ticketId: payload.ticketId,
            action: payload.action,
        });
    }
    /**
     * 发送通知给特定用户
     */
    sendNotificationToUser(userId, notification) {
        const message = {
            type: "notification",
            payload: notification,
            timestamp: new Date().toISOString(),
            userId,
        };
        this.io.to(`user:${userId}`).emit("notification", message);
        logger_1.logger.info("Sent notification to user", {
            userId,
            notificationId: notification.id,
            type: notification.type,
        });
    }
    /**
     * 广播给特定角色
     */
    broadcastToRole(role, message) {
        this.io.to(`role:${role}`).emit(message.type, message);
        logger_1.logger.info("Broadcast to role", { role, messageType: message.type });
    }
    /**
     * 获取在线客户端数量
     */
    getOnlineClientsCount() {
        return this.clients.size;
    }
    /**
     * 获取在线用户列表
     */
    getOnlineUsers() {
        return Array.from(new Set(Array.from(this.clients.values()).map((c) => c.userId)));
    }
    /**
     * 关闭 WebSocket 服务
     */
    close() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.io.close();
        logger_1.logger.info("WebSocket service closed");
    }
}
exports.WebSocketService = WebSocketService;
