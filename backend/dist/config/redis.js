"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.closeRedis = closeRedis;
exports.checkRedisHealth = checkRedisHealth;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
const metrics_1 = require("./metrics");
// Redis 配置
const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || "yyc3:",
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger_1.logger.warn(`Redis connection retry attempt ${times}`);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
};
// 创建 Redis 客户端
exports.redis = new ioredis_1.default(redisConfig);
// 连接事件监听
exports.redis.on("connect", () => {
    logger_1.logger.info("Redis client connecting...");
    metrics_1.redisConnectionStatus.set(0);
});
exports.redis.on("ready", () => {
    logger_1.logger.info("Redis client connected successfully", {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
    });
    metrics_1.redisConnectionStatus.set(1);
    // 开始监控 Redis 指标
    startMetricsCollection();
});
exports.redis.on("error", (error) => {
    logger_1.logger.error("Redis connection error", { error: error.message });
    metrics_1.redisConnectionStatus.set(0);
});
exports.redis.on("close", () => {
    logger_1.logger.warn("Redis connection closed");
    metrics_1.redisConnectionStatus.set(0);
});
exports.redis.on("reconnecting", (delay) => {
    logger_1.logger.info(`Redis reconnecting in ${delay}ms`);
});
exports.redis.on("end", () => {
    logger_1.logger.info("Redis connection ended");
    metrics_1.redisConnectionStatus.set(0);
});
// Redis 指标收集
let metricsInterval = null;
function startMetricsCollection() {
    if (metricsInterval) {
        clearInterval(metricsInterval);
    }
    metricsInterval = setInterval(async () => {
        try {
            const info = await exports.redis.info("memory");
            const memoryMatch = info.match(/used_memory:(\d+)/);
            if (memoryMatch) {
                metrics_1.redisMemoryUsage.set(Number.parseInt(memoryMatch[1]));
            }
            const dbSize = await exports.redis.dbsize();
            metrics_1.redisKeys.set(dbSize);
        }
        catch (error) {
            logger_1.logger.error("Failed to collect Redis metrics", { error });
        }
    }, 30000); // 每30秒收集一次
}
// 优雅关闭
async function closeRedis() {
    if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
    }
    try {
        logger_1.logger.info("Closing Redis connection...");
        await exports.redis.quit();
        logger_1.logger.info("Redis connection closed successfully");
    }
    catch (error) {
        logger_1.logger.error("Error closing Redis connection", { error });
        exports.redis.disconnect();
    }
}
// Redis 健康检查
async function checkRedisHealth() {
    try {
        const start = Date.now();
        await exports.redis.ping();
        const latency = Date.now() - start;
        return {
            status: "healthy",
            latency,
        };
    }
    catch (error) {
        return {
            status: "unhealthy",
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
// 导出 Redis 实例和工具函数
exports.default = exports.redis;
