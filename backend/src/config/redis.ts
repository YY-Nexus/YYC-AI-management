import Redis from "ioredis"
import { logger } from "./logger"
import { redisConnectionStatus, redisMemoryUsage, redisKeys } from "./metrics"

// Redis 配置
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: Number(process.env.REDIS_DB) || 0,
  keyPrefix: process.env.REDIS_KEY_PREFIX || "yyc3:",
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    logger.warn(`Redis connection retry attempt ${times}`)
    return delay
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
}

// 创建 Redis 客户端
export const redis = new Redis(redisConfig)

// 连接事件监听
redis.on("connect", () => {
  logger.info("Redis client connecting...")
  redisConnectionStatus.set(0)
})

redis.on("ready", () => {
  logger.info("Redis client connected successfully", {
    host: redisConfig.host,
    port: redisConfig.port,
    db: redisConfig.db,
  })
  redisConnectionStatus.set(1)

  // 开始监控 Redis 指标
  startMetricsCollection()
})

redis.on("error", (error) => {
  logger.error("Redis connection error", { error: error.message })
  redisConnectionStatus.set(0)
})

redis.on("close", () => {
  logger.warn("Redis connection closed")
  redisConnectionStatus.set(0)
})

redis.on("reconnecting", (delay: number) => {
  logger.info(`Redis reconnecting in ${delay}ms`)
})

redis.on("end", () => {
  logger.info("Redis connection ended")
  redisConnectionStatus.set(0)
})

// Redis 指标收集
let metricsInterval: NodeJS.Timeout | null = null

function startMetricsCollection() {
  if (metricsInterval) {
    clearInterval(metricsInterval)
  }

  metricsInterval = setInterval(async () => {
    try {
      const info = await redis.info("memory")
      const memoryMatch = info.match(/used_memory:(\d+)/)
      if (memoryMatch) {
        redisMemoryUsage.set(Number.parseInt(memoryMatch[1]))
      }

      const dbSize = await redis.dbsize()
      redisKeys.set(dbSize)
    } catch (error) {
      logger.error("Failed to collect Redis metrics", { error })
    }
  }, 30000) // 每30秒收集一次
}

// 优雅关闭
export async function closeRedis(): Promise<void> {
  if (metricsInterval) {
    clearInterval(metricsInterval)
    metricsInterval = null
  }

  try {
    logger.info("Closing Redis connection...")
    await redis.quit()
    logger.info("Redis connection closed successfully")
  } catch (error) {
    logger.error("Error closing Redis connection", { error })
    redis.disconnect()
  }
}

// Redis 健康检查
export async function checkRedisHealth(): Promise<{
  status: "healthy" | "unhealthy"
  latency?: number
  error?: string
}> {
  try {
    const start = Date.now()
    await redis.ping()
    const latency = Date.now() - start

    return {
      status: "healthy",
      latency,
    }
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// 导出 Redis 实例和工具函数
export default redis
