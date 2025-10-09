"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pubSubService = exports.RedisChannel = void 0;
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const events_1 = require("events");
var RedisChannel;
(function (RedisChannel) {
    RedisChannel["AI_ANALYSIS"] = "ai:analysis";
    RedisChannel["RECONCILIATION"] = "reconciliation";
    RedisChannel["NOTIFICATION"] = "notification";
    RedisChannel["WEBSOCKET_BROADCAST"] = "websocket:broadcast";
})(RedisChannel || (exports.RedisChannel = RedisChannel = {}));
class RedisPubSubService extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.subscriptions = new Set();
    }
    /**
     * 初始化订阅监听器
     */
    async initialize() {
        try {
            // 监听消息
            redis_1.redis.on("message", (channel, message) => {
                try {
                    const parsed = JSON.parse(message);
                    logger_1.logger.debug(`[Redis Pub/Sub] Received message on channel ${channel}`, {
                        event: parsed.event,
                        userId: parsed.userId,
                    });
                    this.emit(channel, parsed);
                }
                catch (error) {
                    logger_1.logger.error("[Redis Pub/Sub] Failed to parse message", { error, channel, message });
                }
            });
            // 监听模式匹配消息
            redis_1.redis.on("pmessage", (pattern, channel, message) => {
                try {
                    const parsed = JSON.parse(message);
                    logger_1.logger.debug(`[Redis Pub/Sub] Received pattern message`, {
                        pattern,
                        channel,
                        event: parsed.event,
                    });
                    this.emit(pattern, parsed, channel);
                }
                catch (error) {
                    logger_1.logger.error("[Redis Pub/Sub] Failed to parse pattern message", {
                        error,
                        pattern,
                        channel,
                    });
                }
            });
            logger_1.logger.info("[Redis Pub/Sub] Service initialized successfully");
        }
        catch (error) {
            logger_1.logger.error("[Redis Pub/Sub] Initialization failed", { error });
            throw error;
        }
    }
    /**
     * 订阅频道
     */
    async subscribe(channel) {
        try {
            if (this.subscriptions.has(channel)) {
                logger_1.logger.warn(`[Redis Pub/Sub] Already subscribed to channel: ${channel}`);
                return;
            }
            await redis_1.redis.subscribe(channel);
            this.subscriptions.add(channel);
            logger_1.logger.info(`[Redis Pub/Sub] Subscribed to channel: ${channel}`);
        }
        catch (error) {
            logger_1.logger.error(`[Redis Pub/Sub] Failed to subscribe to channel: ${channel}`, { error });
            throw error;
        }
    }
    /**
     * 订阅模式
     */
    async psubscribe(pattern) {
        try {
            await redis_1.redis.psubscribe(pattern);
            this.subscriptions.add(pattern);
            logger_1.logger.info(`[Redis Pub/Sub] Subscribed to pattern: ${pattern}`);
        }
        catch (error) {
            logger_1.logger.error(`[Redis Pub/Sub] Failed to subscribe to pattern: ${pattern}`, { error });
            throw error;
        }
    }
    /**
     * 取消订阅频道
     */
    async unsubscribe(channel) {
        try {
            await redis_1.redis.unsubscribe(channel);
            this.subscriptions.delete(channel);
            logger_1.logger.info(`[Redis Pub/Sub] Unsubscribed from channel: ${channel}`);
        }
        catch (error) {
            logger_1.logger.error(`[Redis Pub/Sub] Failed to unsubscribe from channel: ${channel}`, { error });
            throw error;
        }
    }
    /**
     * 发布消息
     */
    async publish(channel, message) {
        try {
            const serialized = JSON.stringify({
                ...message,
                timestamp: Date.now(),
            });
            const subscribers = await redis_1.redis.publish(channel, serialized);
            logger_1.logger.debug(`[Redis Pub/Sub] Published message to channel: ${channel}`, {
                event: message.event,
                subscribers,
            });
            return subscribers;
        }
        catch (error) {
            logger_1.logger.error(`[Redis Pub/Sub] Failed to publish to channel: ${channel}`, { error });
            throw error;
        }
    }
    /**
     * 广播消息到所有 WebSocket 连接
     */
    async broadcast(message) {
        await this.publish(RedisChannel.WEBSOCKET_BROADCAST, message);
    }
    /**
     * 发送给特定用户
     */
    async sendToUser(userId, message) {
        await this.publish(`user:${userId}`, {
            ...message,
            userId,
        });
    }
    /**
     * 获取所有订阅的频道
     */
    getSubscriptions() {
        return Array.from(this.subscriptions);
    }
    /**
     * 清理资源
     */
    async cleanup() {
        try {
            for (const channel of this.subscriptions) {
                await this.unsubscribe(channel);
            }
            logger_1.logger.info("[Redis Pub/Sub] Cleanup completed");
        }
        catch (error) {
            logger_1.logger.error("[Redis Pub/Sub] Cleanup failed", { error });
        }
    }
}
exports.pubSubService = new RedisPubSubService();
