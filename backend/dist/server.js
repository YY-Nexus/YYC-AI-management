"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpServer = exports.app = exports.wsService = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const http_1 = require("http");
const logger_1 = require("./config/logger");
const redis_1 = require("./config/redis");
const database_1 = require("./config/database");
const websocket_service_1 = require("./services/websocket.service");
const redis_pubsub_service_1 = require("./services/redis-pubsub.service");
// Middleware and services
const auth_middleware_1 = require("./middleware/auth.middleware");
// Routes
const reconciliation_routes_1 = __importDefault(require("./routes/reconciliation.routes"));
const tickets_routes_1 = __importDefault(require("./routes/tickets.routes"));
const ai_analysis_routes_1 = __importDefault(require("./routes/ai-analysis.routes"));
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const metrics_routes_1 = __importDefault(require("./routes/metrics.routes"));
const security_routes_1 = __importDefault(require("./routes/security.routes"));
const app = (0, express_1.default)();
exports.app = app;
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, helmet_1.default)());
// CORS 配置 - 支持多域名和 Vercel
const getCorsOrigin = () => {
    const origins = [];
    // 从环境变量获取前端 URL
    if (process.env.FRONTEND_BASE_URL) {
        origins.push(process.env.FRONTEND_BASE_URL);
    }
    // 添加允许的域名列表
    if (process.env.ALLOWED_ORIGINS) {
        origins.push(...process.env.ALLOWED_ORIGINS.split(','));
    }
    // 生产环境支持 Vercel 域名
    if (process.env.NODE_ENV === "production") {
        origins.push(/\.vercel\.app$/);
    }
    // 开发环境默认值
    if (origins.length === 0) {
        origins.push("http://localhost:3000");
    }
    return origins;
};
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = getCorsOrigin();
        // 允许没有 origin 的请求
        if (!origin) {
            return callback(null, true);
        }
        // 检查是否允许
        const isAllowed = allowedOrigins.some(allowed => {
            if (typeof allowed === 'string') {
                return allowed === origin;
            }
            return allowed.test(origin);
        });
        if (isAllowed) {
            callback(null, true);
        }
        else {
            callback(null, false);
        }
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        logger_1.logger.info("HTTP Request", {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
        });
    });
    next();
});
// Initialize WebSocket service
exports.wsService = new websocket_service_1.WebSocketService(httpServer);
logger_1.logger.info("WebSocket service initialized");
// API Routes
app.use("/api/auth", auth_routes_1.default);
app.use("/api/reconciliation", auth_middleware_1.authenticate, reconciliation_routes_1.default);
app.use("/api/tickets", auth_middleware_1.authenticate, tickets_routes_1.default);
app.use("/api/ai-analysis", auth_middleware_1.authenticate, ai_analysis_routes_1.default);
app.use("/api/health", health_routes_1.default);
app.use("/api/metrics", metrics_routes_1.default);
app.use("/api/security", auth_middleware_1.authenticate, security_routes_1.default);
// Root endpoint
app.get("/", (req, res) => {
    res.json({
        service: "YanYu Cloud³ Backend API",
        version: "1.0.0",
        status: "running",
        timestamp: new Date().toISOString(),
    });
});
// Error handling
app.use((err, req, res, next) => {
    logger_1.logger.error("Unhandled error", {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    res.status(err.status || 500).json({
        error: {
            message: err.message || "Internal Server Error",
            status: err.status || 500,
        },
    });
});
// Graceful shutdown
const gracefulShutdown = async () => {
    logger_1.logger.info("Received shutdown signal, closing server...");
    // Close WebSocket connections
    exports.wsService.close();
    // Close Redis Pub/Sub
    await redis_pubsub_service_1.pubSubService.cleanup();
    // Close Redis connection
    await (0, redis_1.closeRedis)();
    // Close database pool
    await database_1.pool.end();
    // Close HTTP server
    httpServer.close(() => {
        logger_1.logger.info("Server closed successfully");
        process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => {
        logger_1.logger.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
    }, 10000);
};
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
// Start server
httpServer.listen(PORT, async () => {
    logger_1.logger.info(`🚀 YanYu Cloud³ Backend Server started`, {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        pid: process.pid,
    });
    // Health checks
    const redisHealth = await (0, redis_1.checkRedisHealth)();
    logger_1.logger.info("Redis health check", redisHealth);
    try {
        await database_1.pool.query("SELECT NOW()");
        logger_1.logger.info("✅ Database connection established");
    }
    catch (error) {
        logger_1.logger.error("❌ Database connection failed", { error });
    }
});
