import { Router, type Request, type Response, type NextFunction } from "express"
import { AiAnalysisService } from "../services/ai-analysis.service"
import { OpenAIService } from "../services/openai.service"
import { PromptTemplatesService } from "../services/prompt-templates.service"
import { ReconciliationService } from "../services/reconciliation.service"
import { ticketIntelligenceService } from '../services/ai/ticket-intelligence.service';
import { authenticate as authMiddleware, authorize as checkPermission } from "../middleware/auth.middleware"
import { rateLimiter } from "../middleware/rate-limiter.middleware"
import { validateRequest } from "../middleware/validation.middleware"
import { logger } from "../config/logger"
import * as Joi from "joi"

const router = Router()

// 初始化服务
const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY || "",
  model: process.env.OPENAI_MODEL || "gpt-4o",
  maxRetries: 3,
  timeout: 30000,
  organization: process.env.OPENAI_ORGANIZATION,
}

const openaiService = new OpenAIService(openaiConfig)
const promptService = new PromptTemplatesService()
const reconciliationService = new ReconciliationService()
const aiAnalysisService = new AiAnalysisService(openaiService, promptService, reconciliationService)

// 请求验证 schemas
const analyzeRecordSchema = Joi.object({
  recordId: Joi.string().uuid().required(),
})

const analyzeBatchSchema = Joi.object({
  recordIds: Joi.array().items(Joi.string().uuid()).min(1).max(20).required(),
})

const analyzeTrendsSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
})

// 应用中间件
router.use(authMiddleware)

/**
 * @route   POST /api/ai-analysis/analyze/:recordId
 * @desc    分析单条异常记录
 * @access  Private (需要 ai:analyze 权限)
 */
router.post(
  "/analyze/:recordId",
  checkPermission(["ai:analyze"]),
  rateLimiter({ windowMs: 60000, max: 20 }),
  validateRequest(analyzeRecordSchema, "params"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recordId } = req.params
      const userId = (req as any).user.id

      logger.info("AI analysis requested", { recordId, userId })

      // 生成分析请求
      const analysisRequest = await aiAnalysisService.generateAnalysisRequestForRecord(recordId)

      // 执行分析
      const result = await aiAnalysisService.analyzeException(analysisRequest)

      res.json({
        success: true,
        data: result,
      })
    } catch (error: any) {
      logger.error("AI analysis failed", { error: error.message })
      next(error)
    }
  },
)

/**
 * @route   POST /api/ai-analysis/analyze-batch
 * @desc    批量分析异常记录
 * @access  Private (需要 ai:analyze 权限)
 */
router.post(
  "/analyze-batch",
  checkPermission(["ai:analyze"]),
  rateLimiter({ windowMs: 300000, max: 5 }),
  validateRequest(analyzeBatchSchema, "body"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { recordIds } = req.body
      const userId = (req as any).user.id

      logger.info("Batch AI analysis requested", {
        count: recordIds.length,
        userId,
      })

      // 生成分析请求
      const analysisRequests = await Promise.all(
        recordIds.map((id: string) => aiAnalysisService.generateAnalysisRequestForRecord(id)),
      )

      // 执行批量分析
      const results = await aiAnalysisService.analyzeBatch(analysisRequests)

      res.json({
        success: true,
        data: {
          total: recordIds.length,
          successful: results.length,
          failed: recordIds.length - results.length,
          results,
        },
      })
    } catch (error: any) {
      logger.error("Batch AI analysis failed", { error: error.message })
      next(error)
    }
  },
)

/**
 * @route   POST /api/ai-analysis/analyze-trends
 * @desc    分析异常趋势
 * @access  Private (需要 ai:analyze 权限)
 */
router.post(
  "/analyze-trends",
  checkPermission(["ai:analyze"]),
  rateLimiter({ windowMs: 60000, max: 10 }),
  validateRequest(analyzeTrendsSchema, "body"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.body
      const userId = (req as any).user.id

      logger.info("Trend analysis requested", {
        startDate,
        endDate,
        userId,
      })

      const result = await aiAnalysisService.analyzeTrends({
        start: new Date(startDate),
        end: new Date(endDate),
      })

      res.json({
        success: true,
        data: result,
      })
    } catch (error: any) {
      logger.error("Trend analysis failed", { error: error.message })
      next(error)
    }
  },
)

/**
 * @route   GET /api/ai-analysis/rate-limit
 * @desc    获取 API 速率限制信息
 * @access  Private (需要 ai:analyze 权限)
 */
router.get("/rate-limit", checkPermission(["ai:analyze"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rateLimitInfo = openaiService.getRateLimitInfo()

    res.json({
      success: true,
      data: rateLimitInfo,
    })
  } catch (error) {
    next(error)
  }
})

/**
 * @route   GET /api/ai-analysis/health
 * @desc    检查 OpenAI 连接健康状态
 * @access  Private (需要 ai:analyze 权限)
 */
router.get("/health", checkPermission(["ai:analyze"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isHealthy = await openaiService.validateConnection()

    res.json({
      success: true,
      data: {
        status: isHealthy ? "healthy" : "unhealthy",
        model: openaiConfig.model,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    next(error)
  }
})

/**
 * @route POST /api/ai-analysis/tickets/:id/analyze
 * @desc Analyze a ticket content using AI
 * @access Private (需要 ai:analyze 权限)
 */
router.post(
  '/tickets/:id/analyze',
  checkPermission(['ai:analyze']),
  rateLimiter({ windowMs: 60000, max: 20 }),
  validateRequest(Joi.object({
    content: Joi.string().required().min(10).max(10000).label('Ticket content')
  }), 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: ticketId } = req.params;
      const { content } = req.body;
      const userId = (req as any).user.id;

      logger.info('Ticket analysis requested', { ticketId, userId });

      const analysisResult = await ticketIntelligenceService.analyzeTicket(ticketId, content);
      await ticketIntelligenceService.saveAnalysisResult(ticketId, analysisResult);

      logger.info('Ticket analysis completed successfully', { ticketId });
      res.json({
        success: true,
        data: analysisResult,
        message: 'Ticket analyzed successfully',
      });
    } catch (error: any) {
      logger.error('Failed to analyze ticket', { ticketId: req.params.id, error: error.message });
      next(error);
    }
  }
);

/**
 * @route POST /api/ai-analysis/tickets/:id/reply-recommendation
 * @desc Generate reply recommendation for a ticket
 * @access Private (需要 ai:analyze 权限)
 */
router.post(
  '/tickets/:id/reply-recommendation',
  checkPermission(['ai:analyze']),
  rateLimiter({ windowMs: 60000, max: 20 }),
  validateRequest(Joi.object({
    content: Joi.string().required().min(10).max(10000).label('Ticket content'),
    context: Joi.string().allow('').optional().max(5000).label('Context information')
  }), 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: ticketId } = req.params;
      const { content, context } = req.body;
      const userId = (req as any).user.id;

      logger.info('Reply recommendation requested', { ticketId, userId });

      const replyRecommendation = await ticketIntelligenceService.generateReplyRecommendation(
        ticketId,
        content,
        context
      );

      logger.info('Reply recommendation generated successfully', { ticketId });
      res.json({
        success: true,
        data: replyRecommendation,
        message: 'Reply recommendation generated successfully',
      });
    } catch (error: any) {
      logger.error('Failed to generate reply recommendation', { ticketId: req.params.id, error: error.message });
      next(error);
    }
  }
);

/**
 * @route POST /api/ai-analysis/sentiment
 * @desc Analyze sentiment of text
 * @access Private (需要 ai:analyze 权限)
 */
router.post(
  '/sentiment',
  checkPermission(['ai:analyze']),
  rateLimiter({ windowMs: 60000, max: 50 }),
  validateRequest(Joi.object({
    text: Joi.string().required().min(5).max(5000).label('Text for sentiment analysis')
  }), 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { text } = req.body;
      const userId = (req as any).user.id;

      logger.info('Sentiment analysis requested', { userId });

      const sentimentResult = await ticketIntelligenceService.analyzeSentiment(text);

      logger.info('Sentiment analysis completed successfully');
      res.json({
        success: true,
        data: sentimentResult,
        message: 'Sentiment analysis completed successfully',
      });
    } catch (error: any) {
      logger.error('Failed to analyze sentiment', { error: error.message });
      next(error);
    }
  }
);

/**
 * @route POST /api/ai-analysis/data-extraction
 * @desc Extract structured data from text
 * @access Private (需要 ai:analyze 权限)
 */
router.post(
  '/data-extraction',
  checkPermission(['ai:analyze']),
  rateLimiter({ windowMs: 60000, max: 30 }),
  validateRequest(Joi.object({
    content: Joi.string().required().min(10).max(10000).label('Content for data extraction'),
    targetFields: Joi.array().items(Joi.string()).optional().label('Target fields to extract')
  }), 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content, targetFields } = req.body;
      const userId = (req as any).user.id;

      logger.info('Data extraction requested', { userId });

      const extractionResult = await ticketIntelligenceService.extractSmartData(content, targetFields);

      logger.info('Data extraction completed successfully');
      res.json({
        success: true,
        data: extractionResult,
        message: 'Data extraction completed successfully',
      });
    } catch (error: any) {
      logger.error('Failed to extract data', { error: error.message });
      next(error);
    }
  }
);

/**
 * @route POST /api/ai-analysis/tickets/:id/customer-satisfaction
 * @desc Predict customer satisfaction
 * @access Private (需要 ai:analyze 权限)
 */
router.post(
  '/tickets/:id/customer-satisfaction',
  checkPermission(['ai:analyze']),
  rateLimiter({ windowMs: 60000, max: 20 }),
  validateRequest(Joi.object({
    content: Joi.string().required().min(10).max(10000).label('Ticket content'),
    customerHistory: Joi.string().allow('').optional().max(5000).label('Customer history')
  }), 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: ticketId } = req.params;
      const { content, customerHistory } = req.body;
      const userId = (req as any).user.id;

      logger.info('Customer satisfaction prediction requested', { ticketId, userId });

      const predictionResult = await ticketIntelligenceService.predictCustomerSatisfaction(
        ticketId,
        content,
        customerHistory
      );

      logger.info('Customer satisfaction prediction completed successfully', { ticketId });
      res.json({
        success: true,
        data: predictionResult,
        message: 'Customer satisfaction prediction completed successfully',
      });
    } catch (error: any) {
      logger.error('Failed to predict customer satisfaction', { ticketId: req.params.id, error: error.message });
      next(error);
    }
  }
);

/**
 * @route POST /api/ai-analysis/tickets/batch-classify
 * @desc Batch classify tickets
 * @access Private (需要 ai:analyze 权限)
 */
router.post(
  '/tickets/batch-classify',
  checkPermission(['ai:analyze']),
  rateLimiter({ windowMs: 300000, max: 10 }),
  validateRequest(Joi.object({
    tickets: Joi.array().items(Joi.object({
      id: Joi.string().required().label('Ticket ID'),
      content: Joi.string().required().min(10).max(5000).label('Ticket content')
    })).min(1).max(50).required().label('Tickets to classify'),
    categories: Joi.array().items(Joi.string()).optional().label('Available categories')
  }), 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tickets, categories } = req.body;
      const userId = (req as any).user.id;

      logger.info('Batch ticket classification requested', { count: tickets.length, userId });

      const classificationResult = await ticketIntelligenceService.batchClassifyTickets(tickets, categories);

      logger.info('Batch ticket classification completed successfully');
      res.json({
        success: true,
        data: classificationResult,
        message: 'Batch ticket classification completed successfully',
        totalProcessed: classificationResult.length,
      });
    } catch (error: any) {
      logger.error('Failed to batch classify tickets', { error: error.message });
      next(error);
    }
  }
);

export default router
