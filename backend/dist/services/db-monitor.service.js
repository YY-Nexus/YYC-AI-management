"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbMonitorService = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
class DbMonitorService {
    static async checkQueryPlan(query, params = []) {
        try {
            const explainQuery = `EXPLAIN (FORMAT JSON) ${query}`;
            const result = await database_1.pool.query(explainQuery, params);
            const plan = result.rows[0]["QUERY PLAN"][0];
            // 分析执行计划
            const issues = this.analyzeQueryPlan(plan);
            if (issues.length > 0) {
                logger_1.logger.warn("Query plan issues detected", {
                    query,
                    issues,
                    plan,
                });
            }
            return plan;
        }
        catch (error) {
            logger_1.logger.error("Failed to analyze query plan", {
                query,
                error,
            });
            throw error;
        }
    }
    static analyzeQueryPlan(plan) {
        const issues = [];
        // 检查是否执行了顺序扫描而不是索引扫描
        if (this.findInPlan(plan, "Seq Scan")) {
            issues.push("Sequential scan detected - consider adding an index");
        }
        // 检查是否有昂贵的排序操作
        if (this.findInPlan(plan, "Sort")) {
            issues.push("Expensive sort operation detected");
        }
        // 检查是否有哈希联接而不是嵌套循环联接
        if (this.findInPlan(plan, "Hash Join") &&
            !this.findInPlan(plan, "Nested Loop")) {
            issues.push("Hash join might be inefficient for smaller data sets");
        }
        return issues;
    }
    static findInPlan(plan, nodeName) {
        if (!plan)
            return false;
        if (plan["Node Type"] === nodeName) {
            return true;
        }
        if (plan.Plans) {
            for (const subPlan of plan.Plans) {
                if (this.findInPlan(subPlan, nodeName)) {
                    return true;
                }
            }
        }
        return false;
    }
    // 获取数据库性能统计
    static async getPerformanceStats() {
        try {
            const queries = [
                // 慢查询统计
                {
                    name: "slow_queries",
                    query: `
            SELECT query, calls, total_time, mean_time, rows, 100.0 * shared_blks_hit /
                   nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
            FROM pg_stat_statements 
            ORDER BY total_time DESC 
            LIMIT 10
          `,
                },
                // 数据库连接统计
                {
                    name: "connections",
                    query: `
            SELECT state, count(*) 
            FROM pg_stat_activity 
            WHERE datname = current_database()
            GROUP BY state
          `,
                },
                // 表大小统计
                {
                    name: "table_sizes",
                    query: `
            SELECT schemaname, tablename, 
                   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
            FROM pg_tables 
            WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
            LIMIT 10
          `,
                },
            ];
            const results = {};
            for (const q of queries) {
                try {
                    const result = await database_1.pool.query(q.query);
                    results[q.name] = result.rows;
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to execute performance query: ${q.name}`, {
                        error,
                    });
                    results[q.name] = [];
                }
            }
            return results;
        }
        catch (error) {
            logger_1.logger.error("Failed to get performance stats", { error });
            throw error;
        }
    }
}
exports.DbMonitorService = DbMonitorService;
