"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.checkDatabaseHealth = checkDatabaseHealth;
exports.queryWithMetrics = queryWithMetrics;
exports.closeDatabasePool = closeDatabasePool;
const pg_1 = require("pg");
const logger_1 = require("./logger");
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
exports.pool = new pg_1.Pool(poolConfig);
exports.pool.on("connect", () => {
    logger_1.logger.info("New database connection established");
});
exports.pool.on("error", (err) => {
    logger_1.logger.error("Unexpected database error", err);
    process.exit(-1);
});
// 健康检查
async function checkDatabaseHealth() {
    try {
        const client = await exports.pool.connect();
        await client.query("SELECT 1");
        client.release();
        return true;
    }
    catch (error) {
        logger_1.logger.error("Database health check failed", error);
        return false;
    }
}
// 查询性能日志记录
async function queryWithMetrics(text, params = []) {
    const start = Date.now();
    try {
        const result = await exports.pool.query(text, params);
        const duration = Date.now() - start;
        // 记录慢查询
        if (duration > 1000) {
            // 1秒以上的查询视为慢查询
            logger_1.logger.warn("Slow query detected", {
                query: text,
                duration,
                rowCount: result.rowCount,
            });
        }
        return result;
    }
    catch (error) {
        const duration = Date.now() - start;
        logger_1.logger.error("Query error", {
            query: text,
            duration,
            error,
        });
        throw error;
    }
}
// 优雅关闭
async function closeDatabasePool() {
    await exports.pool.end();
    logger_1.logger.info("Database pool closed");
}
