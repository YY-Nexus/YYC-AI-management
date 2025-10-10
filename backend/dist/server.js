"use strict";
// 在文件顶部添加dotenv导入
const dotenv = require('dotenv');
const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool } = require('./config/database');
const { logger } = require('./config/logger');
const { checkRedisHealth, closeRedis } = require('./config/redis');
const authRoutes = require('./routes/auth.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const securityRoutes = require('./routes/security.routes');
const metricsRoutes = require('./routes/metrics.routes');
const healthRoutes = require('./routes/health.routes');
const WebSocketService = require('./services/websocket.service');
// 配置dotenv，使用绝对路径加载.env.local文件
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;
// 创建HTTP服务器
const httpServer = http.createServer(app);
// 初始化WebSocket服务
const wsService = new WebSocketService(httpServer);
// 安全中间件
app.use(helmet());
// CORS配置
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP最多100个请求
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many requests, please try again later.',
    },
});
app.use(limiter);
// 请求日志
app.use((req, res, next) => {
    const start = Date.now();
    logger.info('Request received', {
        method: req.method,
        url: req.url,
        ip: req.ip,
    });
    // 记录响应时间
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('Request completed', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
        });
    });
    next();
});
// API路由
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/health', healthRoutes);
// 首页路由
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to YanYu Cloud³ Backend API',
        version: process.env.npm_package_version || '1.0.0',
        routes: {
            auth: '/api/auth',
            tickets: '/api/tickets',
            security: '/api/security',
            metrics: '/api/metrics',
            health: '/api/health',
        },
    });
});
// 错误处理中间件
app.use((err, req, res, next) => {
    logger.error('API Error', { error: err.message, stack: err.stack });
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        environment: process.env.NODE_ENV || 'development',
    });
});
// 优雅关闭
const gracefulShutdown = async () => {
    logger.info('Gracefully shutting down server...');
    try {
        // Close WebSocket connections
        if (wsService && wsService.close) {
            wsService.close();
        }
        logger.info('WebSocket connections closed');
        // Close Redis connection
        await closeRedis();
        logger.info('Redis connection closed');
        // Close database connection
        if (pool && pool.end) {
            await pool.end();
            logger.info('Database connection closed');
        }
        // Close HTTP server
        httpServer.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });
        // Force exit after 10 seconds if not closed
        setTimeout(() => {
            logger.error('Forcing shutdown after timeout');
            process.exit(1);
        }, 10000);
    }
    catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
    }
};
// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
// Start server
httpServer.listen(PORT, async () => {
    logger.info(`🚀 YanYu Cloud³ Backend Server started`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid,
    });
    // Health checks
    const redisHealth = await checkRedisHealth();
    logger.info('Redis health check', redisHealth);
    try {
        if (pool && pool.query) {
            await pool.query('SELECT NOW()');
            logger.info('✅ Database connection established');
        }
    }
    catch (error) {
        logger.error('❌ Database connection failed', { error });
    }
});
// 使用CommonJS导出
module.exports = { app, httpServer, wsService };
