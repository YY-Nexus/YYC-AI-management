import { redis as redisPubClient, redis as redisSubClient } from "../config/redis"
import { logger } from "../config/logger"
import { EventEmitter } from "events"

export enum RedisChannel {
  AI_ANALYSIS = "ai:analysis",
  RECONCILIATION = "reconciliation",
  NOTIFICATION = "notification",
  WEBSOCKET_BROADCAST = "websocket:broadcast",
}

export interface PubSubMessage {
  event: string
  data: any
  timestamp: number
  userId?: string
}

class RedisPubSubService extends EventEmitter {
  private subscriptions: Set<string> = new Set()

  /**
   * 初始化订阅监听器
   */
  async initialize(): Promise<void> {
    try {
      // 监听消息
      redisSubClient.on("message", (channel: string, message: string) => {
        try {
          const parsed: PubSubMessage = JSON.parse(message)
          logger.debug(`[Redis Pub/Sub] Received message on channel ${channel}`, {
            event: parsed.event,
            userId: parsed.userId,
          })

          this.emit(channel, parsed)
        } catch (error) {
          logger.error("[Redis Pub/Sub] Failed to parse message", { error, channel, message })
        }
      })

      // 监听模式匹配消息
      redisSubClient.on("pmessage", (pattern: string, channel: string, message: string) => {
        try {
          const parsed: PubSubMessage = JSON.parse(message)
          logger.debug(`[Redis Pub/Sub] Received pattern message`, {
            pattern,
            channel,
            event: parsed.event,
          })

          this.emit(pattern, parsed, channel)
        } catch (error) {
          logger.error("[Redis Pub/Sub] Failed to parse pattern message", {
            error,
            pattern,
            channel,
          })
        }
      })

      logger.info("[Redis Pub/Sub] Service initialized successfully")
    } catch (error) {
      logger.error("[Redis Pub/Sub] Initialization failed", { error })
      throw error
    }
  }

  /**
   * 订阅频道
   */
  async subscribe(channel: RedisChannel | string): Promise<void> {
    try {
      if (this.subscriptions.has(channel)) {
        logger.warn(`[Redis Pub/Sub] Already subscribed to channel: ${channel}`)
        return
      }

      await redisSubClient.subscribe(channel)
      this.subscriptions.add(channel)
      logger.info(`[Redis Pub/Sub] Subscribed to channel: ${channel}`)
    } catch (error) {
      logger.error(`[Redis Pub/Sub] Failed to subscribe to channel: ${channel}`, { error })
      throw error
    }
  }

  /**
   * 订阅模式
   */
  async psubscribe(pattern: string): Promise<void> {
    try {
      await redisSubClient.psubscribe(pattern)
      this.subscriptions.add(pattern)
      logger.info(`[Redis Pub/Sub] Subscribed to pattern: ${pattern}`)
    } catch (error) {
      logger.error(`[Redis Pub/Sub] Failed to subscribe to pattern: ${pattern}`, { error })
      throw error
    }
  }

  /**
   * 取消订阅频道
   */
  async unsubscribe(channel: string): Promise<void> {
    try {
      await redisSubClient.unsubscribe(channel)
      this.subscriptions.delete(channel)
      logger.info(`[Redis Pub/Sub] Unsubscribed from channel: ${channel}`)
    } catch (error) {
      logger.error(`[Redis Pub/Sub] Failed to unsubscribe from channel: ${channel}`, { error })
      throw error
    }
  }

  /**
   * 发布消息
   */
  async publish(channel: RedisChannel | string, message: PubSubMessage): Promise<number> {
    try {
      const serialized = JSON.stringify({
        ...message,
        timestamp: Date.now(),
      })

      const subscribers = await redisPubClient.publish(channel, serialized)

      logger.debug(`[Redis Pub/Sub] Published message to channel: ${channel}`, {
        event: message.event,
        subscribers,
      })

      return subscribers
    } catch (error) {
      logger.error(`[Redis Pub/Sub] Failed to publish to channel: ${channel}`, { error })
      throw error
    }
  }

  /**
   * 广播消息到所有 WebSocket 连接
   */
  async broadcast(message: PubSubMessage): Promise<void> {
    await this.publish(RedisChannel.WEBSOCKET_BROADCAST, message)
  }

  /**
   * 发送给特定用户
   */
  async sendToUser(userId: string, message: PubSubMessage): Promise<void> {
    await this.publish(`user:${userId}`, {
      ...message,
      userId,
    })
  }

  /**
   * 获取所有订阅的频道
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions)
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    try {
      for (const channel of this.subscriptions) {
        await this.unsubscribe(channel)
      }
      logger.info("[Redis Pub/Sub] Cleanup completed")
    } catch (error) {
      logger.error("[Redis Pub/Sub] Cleanup failed", { error })
    }
  }
}

export const pubSubService = new RedisPubSubService()
