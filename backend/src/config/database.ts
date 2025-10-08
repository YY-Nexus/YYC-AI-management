import { Pool, type PoolConfig } from "pg"
import { logger } from "./logger"

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number.parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "yanyu_reconciliation",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  max: Number.parseInt(process.env.DB_POOL_MAX || "20"),
  min: Number.parseInt(process.env.DB_POOL_MIN || "5"),
  idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT || "30000"),
  connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECT_TIMEOUT || "10000"),
}

export const pool = new Pool(poolConfig)

pool.on("connect", () => {
  logger.info("New database connection established")
})

pool.on("error", (err) => {
  logger.error("Unexpected database error", err)
  process.exit(-1)
})

// 健康检查
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect()
    await client.query("SELECT 1")
    client.release()
    return true
  } catch (error) {
    logger.error("Database health check failed", error)
    return false
  }
}

// 优雅关闭
export async function closeDatabasePool(): Promise<void> {
  await pool.end()
  logger.info("Database pool closed")
}
