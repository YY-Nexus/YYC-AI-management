"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const metrics_1 = require("../config/metrics");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
/**
 * @route   GET /health
 * @desc    基础健康检查
 * @access  Public
 */
router.get("/", async (req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
/**
 * @route   GET /health/ready
 * @desc    就绪检查（K8s readiness probe）
 * @access  Public
 */
router.get("/ready", async (req, res) => {
    try {
        // 检查数据库
        const dbHealth = await (0, database_1.checkDatabaseHealth)();
        if (!dbHealth) {
            throw new Error(`Database unhealthy`);
        }
        // 检查 Redis
        const redisHealth = await (0, redis_1.checkRedisHealth)();
        if (!redisHealth) {
            throw new Error(`Redis unhealthy`);
        }
        res.json({
            status: "ready",
            timestamp: new Date().toISOString(),
            checks: {
                database: dbHealth,
                redis: redisHealth,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Readiness check failed", { error });
        res.status(503).json({
            status: "not ready",
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
        });
    }
});
/**
 * @route   GET /health/live
 * @desc    存活检查（K8s liveness probe）
 * @access  Public
 */
router.get("/live", (req, res) => {
    res.json({
        status: "alive",
        timestamp: new Date().toISOString(),
        process: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            pid: process.pid,
        },
    });
});
/**
 * @route   GET /health/metrics
 * @desc    Prometheus 指标端点
 * @access  Public
 */
router.get("/metrics", async (req, res) => {
    try {
        res.set("Content-Type", metrics_1.register.contentType);
        const metrics = await metrics_1.register.metrics();
        res.send(metrics);
    }
    catch (error) {
        logger_1.logger.error("Failed to collect metrics", { error });
        res.status(500).json({
            error: "Failed to collect metrics",
        });
    }
});
exports.default = router;
