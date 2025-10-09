"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIService = void 0;
const openai_1 = __importDefault(require("openai"));
const logger_1 = require("../config/logger");
class OpenAIService {
    constructor(config) {
        this.config = config;
        this.client = new openai_1.default({
            apiKey: config.apiKey,
            organization: config.organization,
            timeout: config.timeout,
            maxRetries: config.maxRetries,
        });
        this.rateLimitInfo = {
            requestsPerMinute: 60,
            tokensPerMinute: 90000,
            currentRequests: 0,
            currentTokens: 0,
            resetTime: new Date(Date.now() + 60000),
        };
        // 重置速率限制计数器
        setInterval(() => {
            this.rateLimitInfo.currentRequests = 0;
            this.rateLimitInfo.currentTokens = 0;
            this.rateLimitInfo.resetTime = new Date(Date.now() + 60000);
        }, 60000);
    }
    /**
     * 检查速率限制
     */
    checkRateLimit(estimatedTokens) {
        if (this.rateLimitInfo.currentRequests >= this.rateLimitInfo.requestsPerMinute) {
            logger_1.logger.warn("Rate limit exceeded: requests per minute", {
                current: this.rateLimitInfo.currentRequests,
                limit: this.rateLimitInfo.requestsPerMinute,
            });
            return false;
        }
        if (this.rateLimitInfo.currentTokens + estimatedTokens >= this.rateLimitInfo.tokensPerMinute) {
            logger_1.logger.warn("Rate limit exceeded: tokens per minute", {
                current: this.rateLimitInfo.currentTokens,
                estimated: estimatedTokens,
                limit: this.rateLimitInfo.tokensPerMinute,
            });
            return false;
        }
        return true;
    }
    /**
     * 更新速率限制计数
     */
    updateRateLimit(tokensUsed) {
        this.rateLimitInfo.currentRequests++;
        this.rateLimitInfo.currentTokens += tokensUsed;
    }
    /**
     * 创建聊天完成请求
     */
    async createChatCompletion(systemMessage, userMessage, options = {}) {
        const estimatedTokens = Math.ceil((systemMessage.length + userMessage.length) / 4);
        if (!this.checkRateLimit(estimatedTokens + (options.maxTokens || 2000))) {
            throw new Error("Rate limit would be exceeded. Please try again later.");
        }
        try {
            const response = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: userMessage },
                ],
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 2000,
                response_format: options.responseFormat,
            });
            const content = response.choices[0]?.message?.content || "";
            const tokensUsed = response.usage?.total_tokens || 0;
            this.updateRateLimit(tokensUsed);
            logger_1.logger.info("OpenAI API call successful", {
                model: response.model,
                tokensUsed,
                finishReason: response.choices[0]?.finish_reason,
            });
            return {
                content,
                tokensUsed,
                model: response.model,
            };
        }
        catch (error) {
            logger_1.logger.error("OpenAI API call failed", {
                error: error.message,
                code: error.code,
                type: error.type,
            });
            if (error.status === 429) {
                throw new Error("OpenAI rate limit exceeded. Please try again later.");
            }
            if (error.status === 401) {
                throw new Error("Invalid OpenAI API key.");
            }
            throw new Error(`OpenAI API error: ${error.message}`);
        }
    }
    /**
     * 估算 tokens 数量
     */
    estimateTokens(text) {
        // 粗略估算：平均每4个字符约等于1个token
        return Math.ceil(text.length / 4);
    }
    /**
     * 获取速率限制信息
     */
    getRateLimitInfo() {
        return { ...this.rateLimitInfo };
    }
    /**
     * 验证 API 连接
     */
    async validateConnection() {
        try {
            const response = await this.client.models.list();
            logger_1.logger.info("OpenAI connection validated", {
                modelsAvailable: response.data.length,
            });
            return true;
        }
        catch (error) {
            logger_1.logger.error("OpenAI connection validation failed", {
                error: error.message,
            });
            return false;
        }
    }
}
exports.OpenAIService = OpenAIService;
