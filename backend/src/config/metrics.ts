import client from "prom-client"

// 创建注册表
const register = new client.Registry()

// 添加默认指标
client.collectDefaultMetrics({ register })

// HTTP 请求指标
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
})

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
})

// 对账业务指标
export const reconciliationProcessed = new client.Counter({
  name: "reconciliation_processed_total",
  help: "Total number of reconciliation records processed",
  labelNames: ["status", "type"],
  registers: [register],
})

export const reconciliationMatchRate = new client.Gauge({
  name: "reconciliation_match_rate",
  help: "Current match rate percentage",
  registers: [register],
})

export const exceptionsTotal = new client.Counter({
  name: "reconciliation_exceptions_total",
  help: "Total number of reconciliation exceptions",
  labelNames: ["exception_type", "severity"],
  registers: [register],
})

// 缓存指标
export const cacheHits = new client.Counter({
  name: "cache_hits_total",
  help: "Total number of cache hits",
  labelNames: ["cache_key_pattern"],
  registers: [register],
})

export const cacheMisses = new client.Counter({
  name: "cache_misses_total",
  help: "Total number of cache misses",
  labelNames: ["cache_key_pattern"],
  registers: [register],
})

export const cacheLatency = new client.Histogram({
  name: "cache_operation_duration_seconds",
  help: "Duration of cache operations in seconds",
  labelNames: ["operation"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register],
})

// AI 分析指标
export const aiAnalysisTotal = new client.Counter({
  name: "ai_analysis_total",
  help: "Total number of AI analysis requests",
  labelNames: ["status", "confidence_level"],
  registers: [register],
})

export const aiAnalysisErrors = new client.Counter({
  name: "ai_analysis_errors_total",
  help: "Total number of AI analysis errors",
  labelNames: ["error_type"],
  registers: [register],
})

export const aiAnalysisLatency = new client.Histogram({
  name: "ai_analysis_duration_seconds",
  help: "Duration of AI analysis in seconds",
  buckets: [1, 2, 5, 10, 15, 30, 60],
  registers: [register],
})

export const aiTokensUsed = new client.Counter({
  name: "ai_tokens_used_total",
  help: "Total number of AI tokens used",
  labelNames: ["model"],
  registers: [register],
})

// 导出注册表
export { register }
