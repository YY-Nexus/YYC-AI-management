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
const express_1 = require("express");
const ai_analysis_service_1 = require("../services/ai-analysis.service");
const openai_service_1 = require("../services/openai.service");
const prompt_templates_service_1 = require("../services/prompt-templates.service");
const reconciliation_service_1 = require("../services/reconciliation.service");
const ticket_intelligence_service_1 = require("../services/ai/ticket-intelligence.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limiter_middleware_1 = require("../middleware/rate-limiter.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const logger_1 = require("../config/logger");
const Joi = __importStar(require("joi"));
const router = (0, express_1.Router)();
// 初始化服务
const openaiConfig = {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o",
    maxRetries: 3,
    timeout: 30000,
    organization: process.env.OPENAI_ORGANIZATION,
};
const openaiService = new openai_service_1.OpenAIService(openaiConfig);
const promptService = new prompt_templates_service_1.PromptTemplatesService();
const reconciliationService = new reconciliation_service_1.ReconciliationService();
const aiAnalysisService = new ai_analysis_service_1.AiAnalysisService(openaiService, promptService, reconciliationService);
// 请求验证 schemas
const analyzeRecordSchema = Joi.object({
    recordId: Joi.string().uuid().required(),
});
const analyzeBatchSchema = Joi.object({
    recordIds: Joi.array().items(Joi.string().uuid()).min(1).max(20).required(),
});
const analyzeTrendsSchema = Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(),
});
// 应用中间件
router.use(auth_middleware_1.authenticate);
/**
 * @route   POST /api/ai-analysis/analyze/:recordId
 * @desc    分析单条异常记录
 * @access  Private (需要 ai:analyze 权限)
 */
router.post("/analyze/:recordId", (0, auth_middleware_1.authorize)(["ai:analyze"]), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 20 }), (0, validation_middleware_1.validateRequest)(analyzeRecordSchema, "params"), async (req, res, next) => {
    try {
        const { recordId } = req.params;
        const userId = req.user.id;
        logger_1.logger.info("AI analysis requested", { recordId, userId });
        // 生成分析请求
        const analysisRequest = await aiAnalysisService.generateAnalysisRequestForRecord(recordId);
        // 执行分析
        const result = await aiAnalysisService.analyzeException(analysisRequest);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error("AI analysis failed", { error: error.message });
        next(error);
    }
});
/**
 * @route   POST /api/ai-analysis/analyze-batch
 * @desc    批量分析异常记录
 * @access  Private (需要 ai:analyze 权限)
 */
router.post("/analyze-batch", (0, auth_middleware_1.authorize)(["ai:analyze"]), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 300000, max: 5 }), (0, validation_middleware_1.validateRequest)(analyzeBatchSchema, "body"), async (req, res, next) => {
    try {
        const { recordIds } = req.body;
        const userId = req.user.id;
        logger_1.logger.info("Batch AI analysis requested", {
            count: recordIds.length,
            userId,
        });
        // 生成分析请求
        const analysisRequests = await Promise.all(recordIds.map((id) => aiAnalysisService.generateAnalysisRequestForRecord(id)));
        // 执行批量分析
        const results = await aiAnalysisService.analyzeBatch(analysisRequests);
        res.json({
            success: true,
            data: {
                total: recordIds.length,
                successful: results.length,
                failed: recordIds.length - results.length,
                results,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Batch AI analysis failed", { error: error.message });
        next(error);
    }
});
/**
 * @route   POST /api/ai-analysis/analyze-trends
 * @desc    分析异常趋势
 * @access  Private (需要 ai:analyze 权限)
 */
router.post("/analyze-trends", (0, auth_middleware_1.authorize)(["ai:analyze"]), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 10 }), (0, validation_middleware_1.validateRequest)(analyzeTrendsSchema, "body"), async (req, res, next) => {
    try {
        const { startDate, endDate } = req.body;
        const userId = req.user.id;
        logger_1.logger.info("Trend analysis requested", {
            startDate,
            endDate,
            userId,
        });
        const result = await aiAnalysisService.analyzeTrends({
            start: new Date(startDate),
            end: new Date(endDate),
        });
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error("Trend analysis failed", { error: error.message });
        next(error);
    }
});
/**
 * @route   GET /api/ai-analysis/rate-limit
 * @desc    获取 API 速率限制信息
 * @access  Private (需要 ai:analyze 权限)
 */
router.get("/rate-limit", (0, auth_middleware_1.authorize)(["ai:analyze"]), async (req, res, next) => {
    try {
        const rateLimitInfo = openaiService.getRateLimitInfo();
        res.json({
            success: true,
            data: rateLimitInfo,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/ai-analysis/health
 * @desc    检查 OpenAI 连接健康状态
 * @access  Private (需要 ai:analyze 权限)
 */
router.get("/health", (0, auth_middleware_1.authorize)(["ai:analyze"]), async (req, res, next) => {
    try {
        const isHealthy = await openaiService.validateConnection();
        res.json({
            success: true,
            data: {
                status: isHealthy ? "healthy" : "unhealthy",
                model: openaiConfig.model,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/ai-analysis/tickets/:id/analyze
 * @desc Analyze a ticket content using AI
 * @access Private (需要 ai:analyze 权限)
 */
router.post('/tickets/:id/analyze', (0, auth_middleware_1.authorize)(['ai:analyze']), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 20 }), (0, validation_middleware_1.validateRequest)(Joi.object({
    content: Joi.string().required().min(10).max(10000).label('Ticket content')
}), 'body'), async (req, res, next) => {
    try {
        const { id: ticketId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        logger_1.logger.info('Ticket analysis requested', { ticketId, userId });
        const analysisResult = await ticket_intelligence_service_1.ticketIntelligenceService.analyzeTicket(ticketId, content);
        await ticket_intelligence_service_1.ticketIntelligenceService.saveAnalysisResult(ticketId, analysisResult);
        logger_1.logger.info('Ticket analysis completed successfully', { ticketId });
        res.json({
            success: true,
            data: analysisResult,
            message: 'Ticket analyzed successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to analyze ticket', { ticketId: req.params.id, error: error.message });
        next(error);
    }
});
/**
 * @route POST /api/ai-analysis/tickets/:id/reply-recommendation
 * @desc Generate reply recommendation for a ticket
 * @access Private (需要 ai:analyze 权限)
 */
router.post('/tickets/:id/reply-recommendation', (0, auth_middleware_1.authorize)(['ai:analyze']), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 20 }), (0, validation_middleware_1.validateRequest)(Joi.object({
    content: Joi.string().required().min(10).max(10000).label('Ticket content'),
    context: Joi.string().allow('').optional().max(5000).label('Context information')
}), 'body'), async (req, res, next) => {
    try {
        const { id: ticketId } = req.params;
        const { content, context } = req.body;
        const userId = req.user.id;
        logger_1.logger.info('Reply recommendation requested', { ticketId, userId });
        const replyRecommendation = await ticket_intelligence_service_1.ticketIntelligenceService.generateReplyRecommendation(ticketId, content, context);
        logger_1.logger.info('Reply recommendation generated successfully', { ticketId });
        res.json({
            success: true,
            data: replyRecommendation,
            message: 'Reply recommendation generated successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to generate reply recommendation', { ticketId: req.params.id, error: error.message });
        next(error);
    }
});
/**
 * @route POST /api/ai-analysis/sentiment
 * @desc Analyze sentiment of text
 * @access Private (需要 ai:analyze 权限)
 */
router.post('/sentiment', (0, auth_middleware_1.authorize)(['ai:analyze']), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 50 }), (0, validation_middleware_1.validateRequest)(Joi.object({
    text: Joi.string().required().min(5).max(5000).label('Text for sentiment analysis')
}), 'body'), async (req, res, next) => {
    try {
        const { text } = req.body;
        const userId = req.user.id;
        logger_1.logger.info('Sentiment analysis requested', { userId });
        const sentimentResult = await ticket_intelligence_service_1.ticketIntelligenceService.analyzeSentiment(text);
        logger_1.logger.info('Sentiment analysis completed successfully');
        res.json({
            success: true,
            data: sentimentResult,
            message: 'Sentiment analysis completed successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to analyze sentiment', { error: error.message });
        next(error);
    }
});
/**
 * @route POST /api/ai-analysis/data-extraction
 * @desc Extract structured data from text
 * @access Private (需要 ai:analyze 权限)
 */
router.post('/data-extraction', (0, auth_middleware_1.authorize)(['ai:analyze']), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 30 }), (0, validation_middleware_1.validateRequest)(Joi.object({
    content: Joi.string().required().min(10).max(10000).label('Content for data extraction'),
    targetFields: Joi.array().items(Joi.string()).optional().label('Target fields to extract')
}), 'body'), async (req, res, next) => {
    try {
        const { content, targetFields } = req.body;
        const userId = req.user.id;
        logger_1.logger.info('Data extraction requested', { userId });
        const extractionResult = await ticket_intelligence_service_1.ticketIntelligenceService.extractSmartData(content, targetFields);
        logger_1.logger.info('Data extraction completed successfully');
        res.json({
            success: true,
            data: extractionResult,
            message: 'Data extraction completed successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to extract data', { error: error.message });
        next(error);
    }
});
/**
 * @route POST /api/ai-analysis/tickets/:id/customer-satisfaction
 * @desc Predict customer satisfaction
 * @access Private (需要 ai:analyze 权限)
 */
router.post('/tickets/:id/customer-satisfaction', (0, auth_middleware_1.authorize)(['ai:analyze']), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 20 }), (0, validation_middleware_1.validateRequest)(Joi.object({
    content: Joi.string().required().min(10).max(10000).label('Ticket content'),
    customerHistory: Joi.string().allow('').optional().max(5000).label('Customer history')
}), 'body'), async (req, res, next) => {
    try {
        const { id: ticketId } = req.params;
        const { content, customerHistory } = req.body;
        const userId = req.user.id;
        logger_1.logger.info('Customer satisfaction prediction requested', { ticketId, userId });
        const predictionResult = await ticket_intelligence_service_1.ticketIntelligenceService.predictCustomerSatisfaction(ticketId, content, customerHistory);
        logger_1.logger.info('Customer satisfaction prediction completed successfully', { ticketId });
        res.json({
            success: true,
            data: predictionResult,
            message: 'Customer satisfaction prediction completed successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to predict customer satisfaction', { ticketId: req.params.id, error: error.message });
        next(error);
    }
});
/**
 * @route POST /api/ai-analysis/tickets/batch-classify
 * @desc Batch classify tickets
 * @access Private (需要 ai:analyze 权限)
 */
router.post('/tickets/batch-classify', (0, auth_middleware_1.authorize)(['ai:analyze']), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 300000, max: 10 }), (0, validation_middleware_1.validateRequest)(Joi.object({
    tickets: Joi.array().items(Joi.object({
        id: Joi.string().required().label('Ticket ID'),
        content: Joi.string().required().min(10).max(5000).label('Ticket content')
    })).min(1).max(50).required().label('Tickets to classify'),
    categories: Joi.array().items(Joi.string()).optional().label('Available categories')
}), 'body'), async (req, res, next) => {
    try {
        const { tickets, categories } = req.body;
        const userId = req.user.id;
        logger_1.logger.info('Batch ticket classification requested', { count: tickets.length, userId });
        const classificationResult = await ticket_intelligence_service_1.ticketIntelligenceService.batchClassifyTickets(tickets, categories);
        logger_1.logger.info('Batch ticket classification completed successfully');
        res.json({
            success: true,
            data: classificationResult,
            message: 'Batch ticket classification completed successfully',
            totalProcessed: classificationResult.length,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to batch classify tickets', { error: error.message });
        next(error);
    }
});
exports.default = router;
