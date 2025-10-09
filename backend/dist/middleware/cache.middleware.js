"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheMiddleware = cacheMiddleware;
exports.invalidateCacheMiddleware = invalidateCacheMiddleware;
const cache_service_1 = require("../services/cache.service");
const logger_1 = require("../config/logger");
/**
 * 缓存中间件
 * 缓存 GET 请求的响应
 */
function cacheMiddleware(options = {}) {
    const { ttl = 300, // 默认5分钟
    prefix = "api", keyGenerator, condition, } = options;
    return async (req, res, next) => {
        // 只缓存 GET 请求
        if (req.method !== "GET") {
            return next();
        }
        // 检查缓存条件
        if (condition && !condition(req)) {
            return next();
        }
        // 生成缓存 key
        const cacheKey = keyGenerator ? keyGenerator(req) : generateCacheKey(req);
        try {
            // 尝试从缓存获取
            const cached = await cache_service_1.cacheService.get(cacheKey, { prefix });
            if (cached) {
                logger_1.logger.debug("Cache middleware hit", { key: cacheKey });
                res.setHeader("X-Cache", "HIT");
                return res.json(cached);
            }
            // 缓存未命中，继续处理请求
            logger_1.logger.debug("Cache middleware miss", { key: cacheKey });
            res.setHeader("X-Cache", "MISS");
            // 拦截响应
            const originalJson = res.json.bind(res);
            res.json = (body) => {
                // 只缓存成功的响应
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    cache_service_1.cacheService.set(cacheKey, body, { ttl, prefix }).catch((error) => {
                        logger_1.logger.error("Failed to cache response", { key: cacheKey, error });
                    });
                }
                return originalJson(body);
            };
            next();
        }
        catch (error) {
            logger_1.logger.error("Cache middleware error", { key: cacheKey, error });
            next();
        }
    };
}
/**
 * 生成默认缓存 key
 */
function generateCacheKey(req) {
    const { path, query } = req;
    const queryString = new URLSearchParams(query).toString();
    return queryString ? `${path}?${queryString}` : path;
}
/**
 * 缓存失效中间件
 * 在数据变更后清除相关缓存
 */
function invalidateCacheMiddleware(options) {
    const { patterns, prefix = "api" } = options;
    return async (req, res, next) => {
        // 拦截响应
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            // 只在成功响应后清除缓存
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const patternsToInvalidate = typeof patterns === "function" ? patterns(req) : patterns;
                Promise.all(patternsToInvalidate.map((pattern) => cache_service_1.cacheService.delPattern(pattern, { prefix }))).catch((error) => {
                    logger_1.logger.error("Failed to invalidate cache", { patterns: patternsToInvalidate, error });
                });
            }
            return originalJson(body);
        };
        next();
    };
}
