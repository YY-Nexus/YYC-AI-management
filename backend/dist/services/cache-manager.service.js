"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const node_cache_1 = __importDefault(require("node-cache"));
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
class CacheManager {
    // 内存缓存 - 适用于高频访问，小体积数据
    static async getFromMemory(key) {
        const data = this.memoryCache.get(key);
        return data === undefined ? null : data;
    }
    static setToMemory(key, data, ttl = 60) {
        return this.memoryCache.set(key, data, ttl);
    }
    // Redis缓存 - 适用于分布式、持久化需求数据
    static async getFromRedis(key) {
        try {
            const data = await redis_1.redis.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            logger_1.logger.error("Redis get error", { key, error });
            return null;
        }
    }
    static async setToRedis(key, data, ttl = 300) {
        try {
            await redis_1.redis.setex(key, ttl, JSON.stringify(data));
        }
        catch (error) {
            logger_1.logger.error("Redis set error", { key, error });
        }
    }
    // 多级缓存包装函数
    static async getOrSet(key, fetcher, options = {}) {
        const { useMemory = true, useRedis = true, memoryTtl = 60, redisTtl = 300, } = options;
        // 尝试从内存缓存获取
        if (useMemory) {
            const memoryData = await this.getFromMemory(key);
            if (memoryData !== null) {
                logger_1.logger.debug("Cache hit from memory", { key });
                return memoryData;
            }
        }
        // 尝试从Redis缓存获取
        if (useRedis) {
            const redisData = await this.getFromRedis(key);
            if (redisData !== null) {
                logger_1.logger.debug("Cache hit from Redis", { key });
                // 如果从Redis获取成功，同时更新内存缓存
                if (useMemory) {
                    this.setToMemory(key, redisData, memoryTtl);
                }
                return redisData;
            }
        }
        // 如果缓存都未命中，执行数据获取函数
        logger_1.logger.debug("Cache miss, fetching data", { key });
        const fetchedData = await fetcher();
        // 更新缓存
        if (useMemory) {
            this.setToMemory(key, fetchedData, memoryTtl);
        }
        if (useRedis) {
            await this.setToRedis(key, fetchedData, redisTtl);
        }
        return fetchedData;
    }
    // 缓存失效函数
    static async invalidate(key) {
        this.memoryCache.del(key);
        try {
            await redis_1.redis.del(key);
        }
        catch (error) {
            logger_1.logger.error("Redis del error", { key, error });
        }
    }
    // 按模式批量失效缓存
    static async invalidatePattern(pattern) {
        // 内存缓存基于前缀匹配删除
        const memoryKeys = this.memoryCache.keys();
        memoryKeys.forEach((k) => {
            if (k.startsWith(pattern)) {
                this.memoryCache.del(k);
            }
        });
        // Redis基于模式删除
        try {
            const redisKeys = await redis_1.redis.keys(`${pattern}*`);
            if (redisKeys.length > 0) {
                await redis_1.redis.del(...redisKeys);
            }
        }
        catch (error) {
            logger_1.logger.error("Redis pattern delete error", { pattern, error });
        }
    }
    // 缓存统计信息
    static getStats() {
        return {
            memory: {
                keys: this.memoryCache.keys().length,
                hits: this.memoryCache.getStats().hits,
                misses: this.memoryCache.getStats().misses,
                keys_list: this.memoryCache.keys(),
            },
        };
    }
}
exports.CacheManager = CacheManager;
CacheManager.memoryCache = new node_cache_1.default({
    stdTTL: 60, // 1分钟默认过期时间
    checkperiod: 120, // 检查过期项目的周期（秒）
    maxKeys: 1000, // 最大缓存项数
});
