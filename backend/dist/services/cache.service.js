"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const metrics_1 = require("../config/metrics");
class CacheService {
    constructor() {
        this.defaultTTL = 3600;
        this.hitCount = 0;
        this.missCount = 0;
    }
    /**
     * 获取缓存
     */
    async get(key, options = {}) {
        const fullKey = this.buildKey(key, options.prefix);
        const start = Date.now();
        try {
            const cached = await redis_1.redis.get(fullKey);
            const duration = (Date.now() - start) / 1000;
            if (cached) {
                this.hitCount++;
                metrics_1.cacheHits.inc({ cache_key_pattern: options.prefix || "default" });
                metrics_1.cacheLatency.observe({ operation: "get", status: "hit" }, duration);
                this.updateHitRate();
                logger_1.logger.debug("Cache hit", { key: fullKey, duration });
                return JSON.parse(cached);
            }
            else {
                this.missCount++;
                metrics_1.cacheMisses.inc();
                metrics_1.cacheLatency.observe({ operation: "get", status: "miss" }, duration);
                this.updateHitRate();
                logger_1.logger.debug("Cache miss", { key: fullKey, duration });
                return null;
            }
        }
        catch (error) {
            const duration = (Date.now() - start) / 1000;
            metrics_1.cacheHits.inc({ cache_key_pattern: options.prefix || "default" });
            metrics_1.cacheLatency.observe({ operation: "get", status: "error" }, duration);
            logger_1.logger.error("Cache get error", { key: fullKey, error });
            return null;
        }
    }
    /**
     * 设置缓存
     */
    async set(key, value, options = {}) {
        const fullKey = this.buildKey(key, options.prefix);
        const ttl = options.ttl || this.defaultTTL;
        const start = Date.now();
        try {
            const serialized = JSON.stringify(value);
            await redis_1.redis.setex(fullKey, ttl, serialized);
            const duration = (Date.now() - start) / 1000;
            metrics_1.cacheLatency.observe({ operation: "set", status: "success" }, duration);
            const size = Buffer.byteLength(serialized, "utf8");
            metrics_1.cacheSize.set({ cache_type: options.prefix || "default" }, size);
            logger_1.logger.debug("Cache set", { key: fullKey, ttl, size, duration });
            return true;
        }
        catch (error) {
            const duration = (Date.now() - start) / 1000;
            metrics_1.cacheLatency.observe({ operation: "set", status: "error" }, duration);
            logger_1.logger.error("Cache set error", { key: fullKey, error });
            return false;
        }
    }
    /**
     * 删除缓存
     */
    async del(key, options = {}) {
        const fullKey = this.buildKey(key, options.prefix);
        const start = Date.now();
        try {
            const result = await redis_1.redis.del(fullKey);
            const duration = (Date.now() - start) / 1000;
            metrics_1.cacheLatency.observe({ operation: "delete", status: "success" }, duration);
            metrics_1.cacheEvictions.inc({ reason: "manual" });
            logger_1.logger.debug("Cache delete", { key: fullKey, result, duration });
            return result > 0;
        }
        catch (error) {
            const duration = (Date.now() - start) / 1000;
            metrics_1.cacheLatency.observe({ operation: "delete", status: "error" }, duration);
            logger_1.logger.error("Cache delete error", { key: fullKey, error });
            return false;
        }
    }
    /**
     * 批量删除缓存（按模式）
     */
    async delPattern(pattern, options = {}) {
        const fullPattern = this.buildKey(pattern, options.prefix);
        const start = Date.now();
        try {
            const keys = await redis_1.redis.keys(fullPattern);
            if (keys.length === 0) {
                return 0;
            }
            const result = await redis_1.redis.del(...keys);
            const duration = (Date.now() - start) / 1000;
            metrics_1.cacheLatency.observe({ operation: "delete_pattern", status: "success" }, duration);
            metrics_1.cacheEvictions.inc({ reason: "pattern" }, keys.length);
            logger_1.logger.info("Cache pattern delete", { pattern: fullPattern, count: result, duration });
            return result;
        }
        catch (error) {
            const duration = (Date.now() - start) / 1000;
            metrics_1.cacheLatency.observe({ operation: "delete_pattern", status: "error" }, duration);
            logger_1.logger.error("Cache pattern delete error", { pattern: fullPattern, error });
            return 0;
        }
    }
    /**
     * 检查缓存是否存在
     */
    async exists(key, options = {}) {
        const fullKey = this.buildKey(key, options.prefix);
        try {
            const result = await redis_1.redis.exists(fullKey);
            return result > 0;
        }
        catch (error) {
            logger_1.logger.error("Cache exists error", { key: fullKey, error });
            return false;
        }
    }
    /**
     * 获取缓存的剩余过期时间（秒）
     */
    async ttl(key, options = {}) {
        const fullKey = this.buildKey(key, options.prefix);
        try {
            return await redis_1.redis.ttl(fullKey);
        }
        catch (error) {
            logger_1.logger.error("Cache TTL error", { key: fullKey, error });
            return -1;
        }
    }
    /**
     * 刷新缓存过期时间
     */
    async expire(key, ttl, options = {}) {
        const fullKey = this.buildKey(key, options.prefix);
        try {
            const result = await redis_1.redis.expire(fullKey, ttl);
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error("Cache expire error", { key: fullKey, error });
            return false;
        }
    }
    /**
     * 🆕 Wrap 方法 - 缓存穿透保护
     * 如果缓存存在则返回，否则执行 fetcher 并缓存结果
     */
    async wrap(key, fetcher, options = {}) {
        const cached = await this.get(key, options);
        if (cached !== null) {
            return cached;
        }
        try {
            const data = await fetcher();
            await this.set(key, data, options);
            return data;
        }
        catch (error) {
            logger_1.logger.error("Cache wrap fetcher error", { key, error });
            throw error;
        }
    }
    /**
     * 原子性递增
     */
    async increment(key, options = {}) {
        const fullKey = this.buildKey(key, options.prefix);
        try {
            return await redis_1.redis.incr(fullKey);
        }
        catch (error) {
            logger_1.logger.error("Cache increment error", { key: fullKey, error });
            return 0;
        }
    }
    /**
     * 原子性递减
     */
    async decrement(key, options = {}) {
        const fullKey = this.buildKey(key, options.prefix);
        try {
            return await redis_1.redis.decr(fullKey);
        }
        catch (error) {
            logger_1.logger.error("Cache decrement error", { key: fullKey, error });
            return 0;
        }
    }
    /**
     * 获取缓存统计
     */
    getStats() {
        const total = this.hitCount + this.missCount;
        const hitRate = total > 0 ? (this.hitCount / total) * 100 : 0;
        return {
            hits: this.hitCount,
            misses: this.missCount,
            total,
            hitRate: hitRate.toFixed(2) + "%",
        };
    }
    /**
     * 重置统计
     */
    resetStats() {
        this.hitCount = 0;
        this.missCount = 0;
    }
    buildKey(key, prefix) {
        if (prefix) {
            return `${prefix}:${key}`;
        }
        return key;
    }
    updateHitRate() {
        const total = this.hitCount + this.missCount;
        if (total > 0) {
            const hitRate = (this.hitCount / total) * 100;
            metrics_1.cacheHitRate.set(hitRate);
        }
    }
}
exports.CacheService = CacheService;
exports.cacheService = new CacheService();
