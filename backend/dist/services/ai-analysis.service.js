"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAnalysisService = void 0;
const logger_1 = require("../config/logger");
const metrics_1 = require("../config/metrics");
class AiAnalysisService {
    constructor(openaiService, promptService, reconciliationService) {
        this.openaiService = openaiService;
        this.promptService = promptService;
        this.reconciliationService = reconciliationService;
    }
    /**
     * 🔧 安全的 JSON 解析
     */
    safeJsonParse(jsonString, fallback = {}) {
        try {
            return JSON.parse(jsonString);
        }
        catch (error) {
            logger_1.logger.error("Failed to parse AI response as JSON", {
                error: error instanceof Error ? error.message : "Unknown error",
                content: jsonString.substring(0, 500),
            });
            // 尝试提取 JSON 代码块
            const jsonBlockMatch = jsonString.match(/```json\n([\s\S]*?)\n```/);
            if (jsonBlockMatch) {
                try {
                    return JSON.parse(jsonBlockMatch[1]);
                }
                catch {
                    // 继续下面的处理
                }
            }
            // 返回默认值
            return fallback;
        }
    }
    /**
     * 分析单条异常记录
     */
    async analyzeException(request) {
        const startTime = Date.now();
        try {
            logger_1.logger.info("Starting AI analysis", { recordId: request.recordId });
            const prompt = this.promptService.buildAnalysisPrompt(request);
            const response = await this.openaiService.createChatCompletion(prompt.systemMessage, prompt.userMessage, {
                temperature: prompt.temperature,
                maxTokens: prompt.maxTokens,
                responseFormat: { type: "json_object" },
            });
            // 🆕 使用安全的 JSON 解析
            const analysis = this.safeJsonParse(response.content, {
                rootCause: "无法解析 AI 响应",
                confidence: 50,
                recommendations: [],
                suggestedActions: [],
                relatedPatterns: [],
            });
            const result = {
                recordId: request.recordId,
                rootCause: analysis.rootCause || "无法确定根本原因",
                confidence: this.validateConfidence(analysis.confidence),
                recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
                suggestedActions: Array.isArray(analysis.suggestedActions)
                    ? analysis.suggestedActions.map(this.validateAction)
                    : [],
                relatedPatterns: Array.isArray(analysis.relatedPatterns) ? analysis.relatedPatterns : [],
                analysisTimestamp: new Date(),
                modelVersion: response.model,
            };
            const duration = (Date.now() - startTime) / 1000;
            metrics_1.aiAnalysisTotal.inc({ status: "success", confidence_level: this.getConfidenceLevel(result.confidence) });
            metrics_1.aiAnalysisLatency.observe(duration);
            logger_1.logger.info("AI analysis completed", {
                recordId: request.recordId,
                confidence: result.confidence,
                duration,
            });
            return result;
        }
        catch (error) {
            const duration = (Date.now() - startTime) / 1000;
            metrics_1.aiAnalysisTotal.inc({ status: "error", confidence_level: "unknown" });
            metrics_1.aiAnalysisErrors.inc({ error_type: error.message.includes("rate limit") ? "rate_limit" : "api_error" });
            metrics_1.aiAnalysisLatency.observe(duration);
            logger_1.logger.error("AI analysis failed", {
                recordId: request.recordId,
                error: error.message,
                duration,
            });
            throw error;
        }
    }
    /**
     * 批量分析异常记录
     */
    async analyzeBatch(requests) {
        logger_1.logger.info("Starting batch AI analysis", { count: requests.length });
        const results = [];
        const batchSize = 5;
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(batch.map((req) => this.analyzeException(req)));
            for (let j = 0; j < batchResults.length; j++) {
                const result = batchResults[j];
                if (result.status === "fulfilled") {
                    results.push(result.value);
                }
                else {
                    logger_1.logger.error("Batch analysis item failed", {
                        recordId: batch[j].recordId,
                        error: result.reason,
                    });
                }
            }
            if (i + batchSize < requests.length) {
                await this.delay(2000);
            }
        }
        logger_1.logger.info("Batch AI analysis completed", {
            total: requests.length,
            successful: results.length,
            failed: requests.length - results.length,
        });
        return results;
    }
    /**
     * 为未匹配记录生成分析请求
     */
    async generateAnalysisRequestForRecord(recordId) {
        const record = await this.reconciliationService.getRecordById(recordId);
        if (!record) {
            throw new Error(`Record not found: ${recordId}`);
        }
        const request = {
            recordId: record.id,
            transactionData: {
                date: record.transactionDate.toISOString().split("T")[0],
                amount: record.amount,
                currency: record.currency,
                description: record.description,
                type: record.transactionType,
                reference: record.bankReference,
                customerName: record.customerName,
            },
        };
        return request;
    }
    /**
     * 分析异常趋势
     */
    async analyzeTrends(timeRange) {
        const exceptions = await this.reconciliationService.getExceptions({
            startDate: timeRange.start.toISOString(),
            endDate: timeRange.end.toISOString(),
            limit: 10000,
        });
        const summary = {
            totalExceptions: exceptions.total,
            exceptionsByType: this.groupBy(exceptions.exceptions, "exceptionType"),
            exceptionsBySeverity: this.groupBy(exceptions.exceptions, "severity"),
            topCustomers: this.getTopCustomers(exceptions.exceptions, 10),
            timeRange: {
                start: timeRange.start.toISOString().split("T")[0],
                end: timeRange.end.toISOString().split("T")[0],
            },
        };
        const prompt = this.promptService.buildTrendAnalysisPrompt(summary);
        const response = await this.openaiService.createChatCompletion(prompt.systemMessage, prompt.userMessage, {
            temperature: 0.4,
            maxTokens: 2000,
            responseFormat: { type: "json_object" },
        });
        return this.safeJsonParse(response.content, {
            trends: [],
            insights: [],
            recommendations: [],
        });
    }
    validateConfidence(confidence) {
        const num = Number(confidence);
        if (Number.isNaN(num))
            return 50;
        return Math.max(0, Math.min(100, num));
    }
    validateAction(action) {
        return {
            action: String(action.action || "未指定行动"),
            priority: ["high", "medium", "low"].includes(action.priority) ? action.priority : "medium",
            estimatedImpact: String(action.estimatedImpact || "未评估"),
        };
    }
    getConfidenceLevel(confidence) {
        if (confidence >= 80)
            return "high";
        if (confidence >= 60)
            return "medium";
        return "low";
    }
    groupBy(items, key) {
        return items.reduce((acc, item) => {
            const value = item[key] || "unknown";
            acc[value] = (acc[value] || 0) + 1;
            return acc;
        }, {});
    }
    getTopCustomers(exceptions, limit) {
        const customerCounts = {};
        exceptions.forEach((ex) => {
            if (ex.customerName) {
                customerCounts[ex.customerName] = (customerCounts[ex.customerName] || 0) + 1;
            }
        });
        return Object.entries(customerCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([customer]) => customer);
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.AiAnalysisService = AiAnalysisService;
