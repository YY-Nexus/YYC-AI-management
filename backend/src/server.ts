import express from "express"
import cors from "cors"
import helmet from "helmet"
import { createServer } from "http"
import { logger } from "./config/logger"
import { closeRedis, checkRedisHealth } from "./config/redis"
import { pool } from "./config/database"
import { WebSocketService } from "./services/websocket.service"
import { notificationService } from "./services/notification.service"
import { redisPubSub } from "./services/redis-pubsub.service"

// Routes
import reconciliationRoutes from "./routes/reconciliation.routes"
import ticketRoutes from "./routes/tickets.routes"
import aiAnalysisRoutes from "./routes/ai-analysis.routes"
import healthRoutes from "./routes/health.routes"

const app = express()
const httpServer = createServer(app)
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_BASE_URL || "http://localhost:3000",
    credentials: true,
  }),
)
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Request logging
app.use((req, res, next) => {
  const start = Date.now()
  res.on("finish", () => {
    const duration = Date.now() - start
    logger.info("HTTP Request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    })
  })
  next()
})

// Initialize WebSocket service
const wsService = new WebSocketService(httpServer)
notificationService.setWebSocketService(wsService)

logger.info("WebSocket service initialized")

// API Routes
app.use("/api/reconciliation", reconciliationRoutes)
app.use("/api/tickets", ticketRoutes)
app.use("/api/ai-analysis", aiAnalysisRoutes)
app.use("/api/health", healthRoutes)

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "YanYu Cloud³ Backend API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
  })
})

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  })

  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal Server Error",
      status: err.status || 500,
    },
  })
})

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info("Received shutdown signal, closing server...")

  // Close WebSocket connections
  wsService.close()

  // Close Redis Pub/Sub
  await redisPubSub.close()

  // Close Redis connection
  await closeRedis()

  // Close database pool
  await pool.end()

  // Close HTTP server
  httpServer.close(() => {
    logger.info("Server closed successfully")
    process.exit(0)
  })

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down")
    process.exit(1)
  }, 10000)
}

process.on("SIGTERM", gracefulShutdown)
process.on("SIGINT", gracefulShutdown)

// Start server
httpServer.listen(PORT, async () => {
  logger.info(`🚀 YanYu Cloud³ Backend Server started`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    pid: process.pid,
  })

  // Health checks
  const redisHealth = await checkRedisHealth()
  logger.info("Redis health check", redisHealth)

  try {
    await pool.query("SELECT NOW()")
    logger.info("✅ Database connection established")
  } catch (error) {
    logger.error("❌ Database connection failed", { error })
  }
})

export { app, httpServer, wsService }
