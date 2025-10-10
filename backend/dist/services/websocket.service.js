"use strict";
const redis = require('../config/redis');
const { logger } = require('../config/logger');
const { AppError } = require('../utils/app-error');
const { ErrorCode } = require('../constants/error-codes');
class WebSocketService {
    constructor(server) {
        this.logger = logger;
        this.io = null;
        this.clients = new Map();
        this.userSockets = new Map();
        this.channels = new Map();
        this.isInitialized = false;
        this.redisClient = null;
        // 如果提供了server参数，直接初始化
        if (server) {
            this.init(server);
        }
    }
    /**
     * 初始化WebSocket服务
     */
    init(server) {
        try {
            // 导入socket.io
            const { Server } = require('socket.io');
            this.io = new Server(server, {
                cors: {
                    origin: '*',
                    methods: ['GET', 'POST'],
                    credentials: true
                },
                transports: ['websocket', 'polling'],
                allowEIO3: true
            });
            this.setupListeners();
            this.setupRedisListeners();
            this.isInitialized = true;
            this.logger.info('WebSocket service initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize WebSocket service', { error: error.message });
            throw new Error('Failed to initialize WebSocket service');
        }
    }
    /**
     * 设置WebSocket监听器
     */
    setupListeners() {
        // 连接事件
        this.io.on('connection', (socket) => {
            this.logger.info('New WebSocket connection established', { socketId: socket.id });
            // 存储客户端信息
            this.clients.set(socket.id, {
                socket,
                userId: null,
                authenticated: false,
                connectedAt: new Date()
            });
            // 认证事件
            socket.on('authenticate', (token) => {
                this.handleAuthentication(socket, token);
            });
            // 消息事件
            socket.on('message', (message) => {
                this.handleMessage(socket, message);
            });
            // 订阅频道事件
            socket.on('subscribe', (data) => {
                this.handleSubscribe(socket, data);
            });
            // 断开连接事件
            socket.on('disconnect', (reason) => {
                this.handleDisconnect(socket, reason);
            });
            // 错误事件
            socket.on('error', (error) => {
                this.logger.error('WebSocket error', {
                    socketId: socket.id,
                    error: error.message || 'Unknown error'
                });
            });
        });
    }
    /**
     * 设置Redis监听器
     */
    setupRedisListeners() {
        try {
            // 获取Redis客户端
            this.redisClient = redis.client;
            // 监听Redis消息
            this.redisClient.on('message', (channel, message) => {
                this.handleRedisMessage(channel, message);
            });
            // 监听Redis错误
            this.redisClient.on('error', (error) => {
                this.logger.error('Redis client error in WebSocket service', {
                    error: error.message || 'Unknown Redis error'
                });
            });
        }
        catch (error) {
            this.logger.error('Failed to setup Redis listeners', { error: error.message });
        }
    }
    /**
     * 处理认证
     */
    async handleAuthentication(socket, token) {
        try {
            if (!token) {
                socket.emit('auth_error', { message: 'Authentication token is required' });
                return;
            }
            // 验证token逻辑
            let userId = null;
            try {
                // 实际项目中这里应该调用auth服务验证token
                // const decoded = await authService.verifyToken(token);
                // userId = decoded.userId;
                // 模拟验证成功
                userId = 'user_' + Math.random().toString(36).substring(2, 10);
            }
            catch (error) {
                socket.emit('auth_error', { message: 'Invalid or expired token' });
                this.logger.warn('WebSocket authentication failed', { socketId: socket.id });
                return;
            }
            // 更新客户端信息
            const clientInfo = this.clients.get(socket.id);
            if (clientInfo) {
                clientInfo.userId = userId;
                clientInfo.authenticated = true;
                // 存储用户的socket连接
                if (!this.userSockets.has(userId)) {
                    this.userSockets.set(userId, new Set());
                }
                this.userSockets.get(userId).add(socket.id);
                // 发送认证成功消息
                socket.emit('auth_success', { userId });
                this.logger.info('WebSocket client authenticated', { socketId: socket.id, userId });
            }
        }
        catch (error) {
            this.logger.error('Error during authentication', { error: error.message });
            socket.emit('auth_error', { message: 'Authentication failed' });
        }
    }
    /**
     * 处理消息
     */
    async handleMessage(socket, message) {
        try {
            const clientInfo = this.clients.get(socket.id);
            if (!clientInfo || !clientInfo.authenticated) {
                socket.emit('error', { message: 'Authentication required' });
                return;
            }
            const { userId } = clientInfo;
            this.logger.info('Received WebSocket message', {
                socketId: socket.id,
                userId,
                messageType: message.type || 'unknown'
            });
            // 根据消息类型处理
            switch (message.type) {
                case 'chat':
                    // 处理聊天消息
                    if (message.recipientId && message.content) {
                        this.sendMessageToUser(message.recipientId, {
                            type: 'chat',
                            senderId: userId,
                            content: message.content,
                            timestamp: new Date().toISOString()
                        });
                    }
                    break;
                case 'notification':
                    // 处理通知消息
                    if (message.data) {
                        this.broadcastNotification(message.data);
                    }
                    break;
                default:
                    this.logger.warn('Unknown message type', { type: message.type });
            }
        }
        catch (error) {
            this.logger.error('Error handling WebSocket message', { error: error.message });
            socket.emit('error', { message: 'Failed to process message' });
        }
    }
    /**
     * 处理订阅
     */
    handleSubscribe(socket, data) {
        try {
            const clientInfo = this.clients.get(socket.id);
            if (!clientInfo || !clientInfo.authenticated) {
                socket.emit('error', { message: 'Authentication required' });
                return;
            }
            const { channel, subscribe = true } = data;
            if (!channel) {
                socket.emit('error', { message: 'Channel name is required' });
                return;
            }
            if (subscribe) {
                // 添加到频道
                if (!this.channels.has(channel)) {
                    this.channels.set(channel, new Set());
                }
                this.channels.get(channel).add(socket.id);
                // 订阅Redis频道
                if (this.redisClient && typeof this.redisClient.subscribe === 'function') {
                    try {
                        this.redisClient.subscribe(channel);
                    }
                    catch (redisError) {
                        this.logger.error('Failed to subscribe to Redis channel', {
                            channel,
                            error: redisError.message
                        });
                    }
                }
                socket.emit('subscribe_success', { channel });
                this.logger.info('Socket subscribed to channel', {
                    socketId: socket.id,
                    channel
                });
            }
            else {
                // 取消订阅
                if (this.channels.has(channel)) {
                    this.channels.get(channel).delete(socket.id);
                    // 如果频道中没有订阅者，清理频道
                    if (this.channels.get(channel).size === 0) {
                        this.channels.delete(channel);
                        // 取消订阅Redis频道
                        if (this.redisClient && typeof this.redisClient.unsubscribe === 'function') {
                            try {
                                this.redisClient.unsubscribe(channel);
                            }
                            catch (redisError) {
                                this.logger.error('Failed to unsubscribe from Redis channel', {
                                    channel,
                                    error: redisError.message
                                });
                            }
                        }
                    }
                }
                socket.emit('unsubscribe_success', { channel });
                this.logger.info('Socket unsubscribed from channel', {
                    socketId: socket.id,
                    channel
                });
            }
        }
        catch (error) {
            this.logger.error('Error handling subscription', { error: error.message });
            socket.emit('error', { message: 'Failed to process subscription' });
        }
    }
    /**
     * 处理断开连接
     */
    handleDisconnect(socket, reason) {
        const socketId = socket.id;
        const clientInfo = this.clients.get(socketId);
        this.logger.info('WebSocket connection closed', {
            socketId,
            reason,
            userId: clientInfo?.userId || 'unauthenticated'
        });
        // 清理客户端信息
        if (clientInfo && clientInfo.userId) {
            // 从用户socket映射中移除
            const userSockets = this.userSockets.get(clientInfo.userId);
            if (userSockets) {
                userSockets.delete(socketId);
                // 如果用户没有其他连接，清理用户socket映射
                if (userSockets.size === 0) {
                    this.userSockets.delete(clientInfo.userId);
                }
            }
        }
        // 从所有频道中移除
        for (const [channel, sockets] of this.channels.entries()) {
            if (sockets.has(socketId)) {
                sockets.delete(socketId);
                // 如果频道中没有订阅者，清理频道
                if (sockets.size === 0) {
                    this.channels.delete(channel);
                    // 取消订阅Redis频道
                    if (this.redisClient && typeof this.redisClient.unsubscribe === 'function') {
                        try {
                            this.redisClient.unsubscribe(channel);
                        }
                        catch (redisError) {
                            this.logger.error('Failed to unsubscribe from Redis channel during cleanup', {
                                channel,
                                error: redisError.message
                            });
                        }
                    }
                }
            }
        }
        // 移除客户端信息
        this.clients.delete(socketId);
    }
    /**
     * 处理Redis消息
     */
    handleRedisMessage(channel, message) {
        try {
            // 解析消息
            let parsedMessage = message;
            if (typeof message === 'string') {
                try {
                    parsedMessage = JSON.parse(message);
                }
                catch (e) {
                    this.logger.warn('Failed to parse Redis message', { channel, error: e.message });
                }
            }
            // 广播到订阅该频道的客户端
            const sockets = this.channels.get(channel);
            if (sockets) {
                sockets.forEach((socketId) => {
                    const client = this.clients.get(socketId);
                    if (client) {
                        client.socket.emit('redis_message', {
                            channel,
                            message: parsedMessage
                        });
                    }
                });
            }
            this.logger.info('Processed Redis message', { channel });
        }
        catch (error) {
            this.logger.error('Error handling Redis message', {
                channel,
                error: error.message
            });
        }
    }
    /**
     * 向特定用户发送消息
     */
    sendMessageToUser(userId, message) {
        try {
            const sockets = this.userSockets.get(userId);
            if (!sockets || sockets.size === 0) {
                this.logger.warn('No active sockets for user', { userId });
                return false;
            }
            sockets.forEach((socketId) => {
                const client = this.clients.get(socketId);
                if (client) {
                    client.socket.emit('message', message);
                }
            });
            this.logger.info('Message sent to user', { userId, messageType: message.type });
            return true;
        }
        catch (error) {
            this.logger.error('Failed to send message to user', {
                userId,
                error: error.message
            });
            return false;
        }
    }
    /**
     * 向所有认证用户广播消息
     */
    broadcastMessage(message) {
        try {
            this.clients.forEach((client, socketId) => {
                if (client.authenticated) {
                    client.socket.emit('message', message);
                }
            });
            this.logger.info('Message broadcasted to all authenticated users', {
                messageType: message.type
            });
            return true;
        }
        catch (error) {
            this.logger.error('Failed to broadcast message', {
                error: error.message
            });
            return false;
        }
    }
    /**
     * 广播通知
     */
    broadcastNotification(notification) {
        try {
            this.clients.forEach((client, socketId) => {
                if (client.authenticated) {
                    client.socket.emit('notification', notification);
                }
            });
            this.logger.info('Notification broadcasted', {
                notificationType: notification.type
            });
            return true;
        }
        catch (error) {
            this.logger.error('Failed to broadcast notification', {
                error: error.message
            });
            return false;
        }
    }
    /**
     * 获取用户的连接数
     */
    getUserConnectionsCount(userId) {
        const sockets = this.userSockets.get(userId);
        return sockets ? sockets.size : 0;
    }
    /**
     * 获取总连接数
     */
    getTotalConnectionsCount() {
        return this.clients.size;
    }
    /**
     * 获取认证用户数
     */
    getAuthenticatedUsersCount() {
        return this.userSockets.size;
    }
    /**
     * 关闭WebSocket服务
     */
    close() {
        try {
            if (this.io) {
                this.io.close();
            }
            // 清理资源
            this.clients.clear();
            this.userSockets.clear();
            this.channels.clear();
            this.isInitialized = false;
            return true;
        }
        catch (error) {
            this.logger.error('Error closing WebSocket service', {
                error: error.message
            });
            return false;
        }
    }
    // AI分析相关的发布方法
    publishAiAnalysis(userId, analysisData) {
        try {
            // 向特定用户发送AI分析结果
            return this.sendMessageToUser(userId, {
                type: 'ai_analysis',
                data: analysisData,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('Failed to publish AI analysis', {
                userId,
                error: error.message
            });
            return false;
        }
    }
    // 发布系统通知
    publishSystemNotification(notification) {
        try {
            // 广播系统通知
            return this.broadcastNotification({
                type: 'system_notification',
                data: notification,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.logger.error('Failed to publish system notification', {
                error: error.message
            });
            return false;
        }
    }
}
// 导出服务类（注意：这里只导出类，不创建单例实例）
module.exports = WebSocketService;
