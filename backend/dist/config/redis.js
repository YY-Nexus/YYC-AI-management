"use strict";
const { logger } = require("./logger");
const { redisConnectionStatus, redisMemoryUsage, redisKeys } = require("./metrics");
const Redis = require('ioredis');
const { logger } = require('./logger');
// Redis 配置
const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB) || 0,
    keyPrefix: process.env.REDIS_KEY_PREFIX || "yyc3:",
    connectTimeout: 10000, // 10秒连接超时
    retryStrategy: (times) => {
        // 指数退避策略
        const delay = Math.min(times * 1000, 15000); // 最大15秒
        return delay;
    },
    maxRetriesPerRequest: 3, // 每个请求最大重试次数
    clusterMode: process.env.REDIS_CLUSTER_MODE === 'true',
};
// Redis默认TTL配置 (秒)
const REDIS_TTL = Number(process.env.REDIS_TTL) || 3600;
// 创建Redis客户端实例
const redis = new Redis(redisConfig);
// Redis连接事件监听
redis.on("connect", () => {
    logger.info("Redis连接成功", {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db,
    });
    redisConnectionStatus.set(1); // 连接状态设为1（已连接）
});
redis.on("error", (error) => {
    logger.error("Redis连接错误", {
        error: error.message,
        host: redisConfig.host,
        port: redisConfig.port,
    });
    redisConnectionStatus.set(0); // 连接状态设为0（未连接）
});
redis.on("close", () => {
    logger.warn("Redis连接关闭");
    redisConnectionStatus.set(0); // 连接状态设为0（未连接）
});
// 定期记录Redis内存使用情况
setInterval(async () => {
    try {
        const info = await redis.info('memory');
        const memoryUsed = info.match(/used_memory_human:(\d+\.\d+ \w+)/)?.[1];
        const memoryPeak = info.match(/used_memory_peak_human:(\d+\.\d+ \w+)/)?.[1];
        if (memoryUsed && memoryPeak) {
            redisMemoryUsage.set({
                memoryUsed,
                memoryPeak
            });
        }
    }
    catch (error) {
        logger.error("获取Redis内存信息失败", { error });
    }
}, 60000); // 每分钟检查一次
// 定期更新Redis键数量指标
setInterval(async () => {
    try {
        const keys = await redis.keys('*');
        redisKeys.set(keys.length);
    }
    catch (error) {
        logger.error("获取Redis键数量失败", { error });
    }
}, 30000); // 每30秒检查一次
// 发布消息
async function publish(channel, message) {
    try {
        await redis.publish(channel, JSON.stringify(message));
        logger.debug(`消息发布到频道 ${channel}`, { message });
        return true;
    }
    catch (error) {
        logger.error(`消息发布失败到频道 ${channel}`, { error });
        return false;
    }
}
// 订阅频道
function subscribe(channel, callback) {
    try {
        const subscriber = new Redis(redisConfig);
        subscriber.subscribe(channel);
        subscriber.on('message', (receivedChannel, message) => {
            if (receivedChannel === channel) {
                try {
                    const parsedMessage = JSON.parse(message);
                    callback(parsedMessage);
                }
                catch (error) {
                    logger.error(`解析消息失败`, { error });
                }
            }
        });
        // 处理订阅错误
        subscriber.on('error', (error) => {
            logger.error(`Redis订阅错误 ${channel}`, { error });
        });
        return subscriber;
    }
    catch (error) {
        logger.error(`订阅频道 ${channel} 失败`, { error });
        return null;
    }
}
// 取消订阅
function unsubscribe(subscriber, channel) {
    try {
        subscriber.unsubscribe(channel);
        subscriber.quit();
        logger.debug(`取消订阅频道 ${channel}`);
        return true;
    }
    catch (error) {
        logger.error(`取消订阅频道 ${channel} 失败`, { error });
        return false;
    }
}
// 设置键值对
async function set(key, value, ttl = null) {
    try {
        const effectiveTtl = ttl || REDIS_TTL;
        if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
        }
        if (effectiveTtl > 0) {
            await redis.set(key, value, 'EX', effectiveTtl);
        }
        else {
            await redis.set(key, value);
        }
        logger.debug(`Redis设置键 ${key}`, { ttl: effectiveTtl });
        return true;
    }
    catch (error) {
        logger.error(`Redis设置键 ${key} 失败`, { error });
        return false;
    }
}
// 获取键值对
async function get(key) {
    try {
        const value = await redis.get(key);
        if (value === null) {
            return null;
        }
        // 尝试解析为JSON对象
        try {
            return JSON.parse(value);
        }
        catch (e) {
            return value;
        }
    }
    catch (error) {
        logger.error(`Redis获取键 ${key} 失败`, { error });
        return null;
    }
}
// 删除键
async function del(key) {
    try {
        await redis.del(key);
        logger.debug(`Redis删除键 ${key}`);
        return true;
    }
    catch (error) {
        logger.error(`Redis删除键 ${key} 失败`, { error });
        return false;
    }
}
// 检查键是否存在
async function exists(key) {
    try {
        const exists = await redis.exists(key);
        return exists > 0;
    }
    catch (error) {
        logger.error(`Redis检查键 ${key} 存在性失败`, { error });
        return false;
    }
}
// 设置哈希表字段
async function hset(key, field, value) {
    try {
        if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
        }
        await redis.hset(key, field, value);
        logger.debug(`Redis设置哈希字段 ${key}.${field}`);
        return true;
    }
    catch (error) {
        logger.error(`Redis设置哈希字段 ${key}.${field} 失败`, { error });
        return false;
    }
}
// 获取哈希表字段
async function hget(key, field) {
    try {
        const value = await redis.hget(key, field);
        if (value === null) {
            return null;
        }
        // 尝试解析为JSON对象
        try {
            return JSON.parse(value);
        }
        catch (e) {
            return value;
        }
    }
    catch (error) {
        logger.error(`Redis获取哈希字段 ${key}.${field} 失败`, { error });
        return null;
    }
}
// 获取整个哈希表
async function hgetall(key) {
    try {
        const hash = await redis.hgetall(key);
        // 如果哈希表为空，redis.hgetall返回空对象，而不是null
        if (Object.keys(hash).length === 0) {
            return null;
        }
        // 尝试解析每个字段的值为JSON对象
        const parsedHash = {};
        for (const [field, value] of Object.entries(hash)) {
            try {
                parsedHash[field] = JSON.parse(value);
            }
            catch (e) {
                parsedHash[field] = value;
            }
        }
        return parsedHash;
    }
    catch (error) {
        logger.error(`Redis获取哈希表 ${key} 失败`, { error });
        return null;
    }
}
// 向列表左侧添加元素
async function lpush(key, value) {
    try {
        if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
        }
        await redis.lpush(key, value);
        logger.debug(`Redis向列表 ${key} 左侧添加元素`);
        return true;
    }
    catch (error) {
        logger.error(`Redis向列表 ${key} 左侧添加元素失败`, { error });
        return false;
    }
}
// 向列表右侧添加元素
async function rpush(key, value) {
    try {
        if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
        }
        await redis.rpush(key, value);
        logger.debug(`Redis向列表 ${key} 右侧添加元素`);
        return true;
    }
    catch (error) {
        logger.error(`Redis向列表 ${key} 右侧添加元素失败`, { error });
        return false;
    }
}
// 获取列表范围
async function lrange(key, start, stop) {
    try {
        const elements = await redis.lrange(key, start, stop);
        // 尝试解析每个元素为JSON对象
        const parsedElements = elements.map(element => {
            try {
                return JSON.parse(element);
            }
            catch (e) {
                return element;
            }
        });
        return parsedElements;
    }
    catch (error) {
        logger.error(`Redis获取列表 ${key} 范围失败`, { error });
        return [];
    }
}
// 增加计数器
async function incr(key, increment = 1) {
    try {
        const result = await redis.incrby(key, increment);
        logger.debug(`Redis计数器 ${key} 增加 ${increment}`);
        return result;
    }
    catch (error) {
        logger.error(`Redis计数器 ${key} 增加失败`, { error });
        return null;
    }
}
// 减少计数器
async function decr(key, decrement = 1) {
    try {
        const result = await redis.decrby(key, decrement);
        logger.debug(`Redis计数器 ${key} 减少 ${decrement}`);
        return result;
    }
    catch (error) {
        logger.error(`Redis计数器 ${key} 减少失败`, { error });
        return null;
    }
}
// 获取Redis客户端实例
function getClient() {
    return redis;
}
// 关闭Redis连接
async function close() {
    try {
        await redis.quit();
        logger.info("Redis连接已关闭");
        return true;
    }
    catch (error) {
        logger.error("关闭Redis连接失败", { error });
        return false;
    }
}
// 导出Redis客户端和方法
module.exports = {
    redis,
    REDIS_TTL,
    publish,
    subscribe,
    unsubscribe,
    set,
    get,
    del,
    exists,
    hset,
    hget,
    hgetall,
    lpush,
    rpush,
    lrange,
    incr,
    decr,
    getClient,
    close
};
