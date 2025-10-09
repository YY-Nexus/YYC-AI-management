"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketIntelligenceService = exports.TicketIntelligenceService = void 0;
const openai_1 = require("openai");
const database_1 = require("../../config/database");
const logger_1 = require("../../config/logger");
const app_error_1 = require("../../utils/app-error");
const error_codes_1 = require("../../constants/error-codes");
class TicketIntelligenceService {
    constructor() {
        this.model = 'gpt-4o';
        // 初始化OpenAI客户端
        this.openai = new openai_1.OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            organization: process.env.OPENAI_ORGANIZATION,
        });
        logger_1.logger.info('Ticket Intelligence Service initialized');
    }
    /**
     * 分析工单内容，提取情感、紧急程度、分类等信息
     */
    async analyzeTicket(ticketId, content) {
        try {
            logger_1.logger.info('Analyzing ticket content', { ticketId });
            const prompt = `Analyze the following ticket content and provide a structured analysis including sentiment, urgency, category, keywords, and a summary.

Ticket Content: ${content}

Please respond in JSON format with the following structure:
{
  "sentiment": "positive" | "negative" | "neutral",
  "urgency": "low" | "medium" | "high" | "critical",
  "category": "A short category name",
  "keywords": ["array", "of", "relevant", "keywords"],
  "summary": "A brief summary of the ticket content"
}`;
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.3,
            });
            const result = JSON.parse(response.choices[0].message.content || '{}');
            // 验证结果
            if (!result.sentiment || !result.urgency || !result.category) {
                throw new Error('Invalid analysis result from AI service');
            }
            logger_1.logger.info('Ticket analysis completed successfully', { ticketId });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to analyze ticket', { ticketId, error });
            throw app_error_1.AppError.internal('Failed to analyze ticket content', error_codes_1.ErrorCode.AI_ANALYSIS_FAILED);
        }
    }
    /**
     * 生成工单回复建议
     */
    async generateReplyRecommendation(ticketId, content, context) {
        try {
            logger_1.logger.info('Generating reply recommendation', { ticketId });
            const contextPrompt = context ? `\n\nContext information:\n${context}` : '';
            const prompt = `Generate a professional reply recommendation for the following ticket. The reply should be helpful, empathetic, and address the core issue.\n\nTicket Content: ${content}${contextPrompt}\n\nPlease respond in JSON format with the following structure:\n{\n  "content": "The recommended reply content",\n  "confidence": 0.0-1.0,\n  "tone": "A description of the tone (e.g., professional, empathetic, informative)",\n  "suggestedActions": ["array", "of", "suggested", "actions"]\n}`;
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.7,
            });
            const result = JSON.parse(response.choices[0].message.content || '{}');
            if (!result.content) {
                throw new Error('Invalid reply recommendation from AI service');
            }
            logger_1.logger.info('Reply recommendation generated successfully', { ticketId });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate reply recommendation', { ticketId, error });
            throw app_error_1.AppError.internal('Failed to generate reply recommendation', error_codes_1.ErrorCode.AI_REPLY_GENERATION_FAILED);
        }
    }
    /**
     * 执行情感分析
     */
    async analyzeSentiment(content) {
        try {
            logger_1.logger.info('Performing sentiment analysis');
            const prompt = `Analyze the sentiment of the following text and provide a sentiment label and score.\n\nText: ${content}\n\nPlease respond in JSON format with the following structure:\n{\n  "sentiment": "positive" | "negative" | "neutral",\n  "score": -1.0 to 1.0\n}`;
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.3,
            });
            const result = JSON.parse(response.choices[0].message.content || '{}');
            if (!result.sentiment || result.score === undefined) {
                throw new Error('Invalid sentiment analysis result');
            }
            logger_1.logger.info('Sentiment analysis completed successfully');
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to perform sentiment analysis', { error });
            throw app_error_1.AppError.internal('Failed to analyze sentiment', error_codes_1.ErrorCode.AI_SENTIMENT_ANALYSIS_FAILED);
        }
    }
    /**
     * 智能数据提取
     */
    async extractSmartData(content, targetFields) {
        try {
            logger_1.logger.info('Extracting smart data from content');
            const fieldsPrompt = targetFields && targetFields.length > 0
                ? `\n\nTarget fields to extract: ${targetFields.join(', ')}`
                : '';
            const prompt = `Extract structured data from the following content. Identify key entities, main issues, and required actions.${fieldsPrompt}\n\nContent: ${content}\n\nPlease respond in JSON format with the following structure:\n{\n  "entities": {"key": "value"},\n  "keyIssues": ["array", "of", "key", "issues"],\n  "requiredActions": ["array", "of", "required", "actions"]\n}`;
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.3,
            });
            const result = JSON.parse(response.choices[0].message.content || '{}');
            if (!result.entities) {
                throw new Error('Invalid data extraction result');
            }
            logger_1.logger.info('Smart data extraction completed successfully');
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to extract smart data', { error });
            throw app_error_1.AppError.internal('Failed to extract smart data', error_codes_1.ErrorCode.AI_DATA_EXTRACTION_FAILED);
        }
    }
    /**
     * 预测客户满意度
     */
    async predictCustomerSatisfaction(ticketId, content, customerHistory) {
        try {
            logger_1.logger.info('Predicting customer satisfaction', { ticketId });
            const historyPrompt = customerHistory ? `\n\nCustomer history:\n${customerHistory}` : '';
            const prompt = `Based on the ticket content and customer history, predict the customer's satisfaction score.\n\nTicket Content: ${content}${historyPrompt}\n\nPlease respond in JSON format with the following structure:\n{\n  "score": 1-10,\n  "factors": ["factors", "influencing", "the", "prediction"],\n  "confidence": 0.0-1.0\n}`;
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.4,
            });
            const result = JSON.parse(response.choices[0].message.content || '{}');
            if (result.score === undefined) {
                throw new Error('Invalid satisfaction prediction result');
            }
            logger_1.logger.info('Customer satisfaction prediction completed successfully', { ticketId });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to predict customer satisfaction', { ticketId, error });
            throw app_error_1.AppError.internal('Failed to predict customer satisfaction', error_codes_1.ErrorCode.AI_SATISFACTION_PREDICTION_FAILED);
        }
    }
    /**
     * 批量分类工单
     */
    async batchClassifyTickets(tickets, categories) {
        try {
            logger_1.logger.info('Batch classifying tickets', { count: tickets.length });
            const categoriesPrompt = categories && categories.length > 0
                ? `\n\nAvailable categories: ${categories.join(', ')}`
                : '';
            const prompt = `Classify the following tickets into appropriate categories.${categoriesPrompt}\n\nTickets: ${JSON.stringify(tickets)}\n\nPlease respond in JSON format with an array of objects with the following structure:\n[\n  {\n    "ticketId": "string",\n    "category": "string",\n    "confidence": 0.0-1.0\n  }\n]`;
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.3,
            });
            const result = JSON.parse(response.choices[0].message.content || '[]');
            if (!Array.isArray(result)) {
                throw new Error('Invalid batch classification result');
            }
            logger_1.logger.info('Batch classification completed successfully');
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to batch classify tickets', { error });
            throw app_error_1.AppError.internal('Failed to batch classify tickets', error_codes_1.ErrorCode.AI_BATCH_CLASSIFICATION_FAILED);
        }
    }
    /**
     * 保存AI分析结果到数据库
     */
    async saveAnalysisResult(ticketId, analysis) {
        try {
            await database_1.pool.query(`INSERT INTO ticket_ai_analyses (ticket_id, sentiment, urgency, category, keywords, summary, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (ticket_id) DO UPDATE
         SET sentiment = $2, urgency = $3, category = $4, keywords = $5, summary = $6, updated_at = NOW()`, [ticketId, analysis.sentiment, analysis.urgency, analysis.category, analysis.keywords, analysis.summary]);
            logger_1.logger.info('AI analysis result saved to database', { ticketId });
        }
        catch (error) {
            logger_1.logger.error('Failed to save AI analysis result', { ticketId, error });
            throw app_error_1.AppError.internal('Failed to save analysis result', error_codes_1.ErrorCode.DATABASE_ERROR);
        }
    }
}
exports.TicketIntelligenceService = TicketIntelligenceService;
// 创建单例实例
exports.ticketIntelligenceService = new TicketIntelligenceService();
