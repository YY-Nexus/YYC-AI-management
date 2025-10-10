"use strict";
// 修复database.ts文件中的TypeScript错误，统一使用CommonJS格式
const { Pool } = require('pg');
const { logger } = require('./logger');
// 定义连接池配置
const poolConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number.parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "yanyu_reconciliation",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    max: Number.parseInt(process.env.DB_POOL_MAX || "20"),
    min: Number.parseInt(process.env.DB_POOL_MIN || "5"),
    idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT || "30000"),
    connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT || "10000"),
};
const pool = new Pool(poolConfig);
pool.on("connect", () => {
    logger.info("New database connection established");
});
pool.on("error", (err) => {
    logger.error("Unexpected database error", { error: err });
    process.exit(-1);
});
// 健康检查
const checkDatabaseHealth = async () => {
    try {
        const client = await pool.connect();
        await client.query("SELECT 1");
        client.release();
        return true;
    }
    catch (error) {
        logger.error("Database health check failed", { error });
        return false;
    }
};
// 查询性能日志记录
/**
 * @param {string} text - SQL查询语句
 * @param {Array} params - 查询参数数组
 * @returns {Promise<Object>} 查询结果
 */
const queryWithMetrics = async (text, params = []) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        // 记录慢查询
        if (duration > 1000) {
            // 1秒以上的查询视为慢查询
            logger.warn("Slow query detected", {
                query: text,
                duration,
                rowCount: result.rowCount,
            });
        }
        return result;
    }
    catch (error) {
        const duration = Date.now() - start;
        logger.error("Query error", {
            query: text,
            duration,
            error,
        });
        throw error;
    }
};
// 优雅关闭
const closeDatabasePool = async () => {
    await pool.end();
    logger.info("Database pool closed");
};
// 使用CommonJS导出
module.exports = {
    pool,
    checkDatabaseHealth,
    queryWithMetrics,
    closeDatabasePool
};
