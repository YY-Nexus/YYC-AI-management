"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = exports.aiTokensUsed = exports.aiAnalysisLatency = exports.aiAnalysisErrors = exports.aiAnalysisTotal = exports.csvImportDuration = exports.cacheLatency = exports.cacheHitRate = exports.cacheEvictions = exports.cacheSize = exports.cacheMisses = exports.cacheHits = exports.redisKeys = exports.redisMemoryUsage = exports.redisConnectionStatus = exports.exceptionsTotal = exports.reconciliationMatchRate = exports.reconciliationProcessed = exports.httpRequestDuration = exports.httpRequestsTotal = void 0;
const client = __importStar(require("prom-client"));
// 创建注册表
const register = new client.Registry();
exports.register = register;
// 添加默认指标
client.collectDefaultMetrics({ register });
// HTTP 请求指标
exports.httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
});
exports.httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
});
// 对账业务指标
exports.reconciliationProcessed = new client.Counter({
    name: "reconciliation_processed_total",
    help: "Total number of reconciliation records processed",
    labelNames: ["status", "type"],
    registers: [register],
});
exports.reconciliationMatchRate = new client.Gauge({
    name: "reconciliation_match_rate",
    help: "Current match rate percentage",
    registers: [register],
});
exports.exceptionsTotal = new client.Counter({
    name: "reconciliation_exceptions_total",
    help: "Total number of reconciliation exceptions",
    labelNames: ["exception_type", "severity"],
    registers: [register],
});
// Redis 指标
exports.redisConnectionStatus = new client.Gauge({
    name: "redis_connection_status",
    help: "Redis connection status (0 = disconnected, 1 = connected)",
    registers: [register],
});
exports.redisMemoryUsage = new client.Gauge({
    name: "redis_memory_used_bytes",
    help: "Memory used by Redis in bytes",
    registers: [register],
});
exports.redisKeys = new client.Gauge({
    name: "redis_keys_total",
    help: "Total number of keys in Redis",
    registers: [register],
});
// 缓存指标
exports.cacheHits = new client.Counter({
    name: "cache_hits_total",
    help: "Total number of cache hits",
    labelNames: ["cache_key_pattern"],
    registers: [register],
});
exports.cacheMisses = new client.Counter({
    name: "cache_misses_total",
    help: "Total number of cache misses",
    labelNames: ["cache_key_pattern"],
    registers: [register],
});
exports.cacheSize = new client.Gauge({
    name: "cache_size_bytes",
    help: "Current cache size in bytes",
    registers: [register],
});
exports.cacheEvictions = new client.Counter({
    name: "cache_evictions_total",
    help: "Total number of cache evictions",
    labelNames: ["reason"],
    registers: [register],
});
exports.cacheHitRate = new client.Gauge({
    name: "cache_hit_rate_ratio",
    help: "Current cache hit rate percentage",
    registers: [register],
});
exports.cacheLatency = new client.Histogram({
    name: "cache_operation_duration_seconds",
    help: "Duration of cache operations in seconds",
    labelNames: ["operation", "status"],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
    registers: [register],
});
// CSV 导入指标
exports.csvImportDuration = new client.Histogram({
    name: "csv_import_duration_seconds",
    help: "Duration of CSV import operations in seconds",
    buckets: [10, 30, 60, 120, 300],
    registers: [register],
});
// AI 分析指标
exports.aiAnalysisTotal = new client.Counter({
    name: "ai_analysis_total",
    help: "Total number of AI analysis requests",
    labelNames: ["status", "confidence_level"],
    registers: [register],
});
exports.aiAnalysisErrors = new client.Counter({
    name: "ai_analysis_errors_total",
    help: "Total number of AI analysis errors",
    labelNames: ["error_type"],
    registers: [register],
});
exports.aiAnalysisLatency = new client.Histogram({
    name: "ai_analysis_duration_seconds",
    help: "Duration of AI analysis in seconds",
    buckets: [1, 2, 5, 10, 15, 30, 60],
    registers: [register],
});
exports.aiTokensUsed = new client.Counter({
    name: "ai_tokens_used_total",
    help: "Total number of AI tokens used",
    labelNames: ["model"],
    registers: [register],
});
