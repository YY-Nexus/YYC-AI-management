import { Router, type Request, type Response, type NextFunction } from "express"
import { ReconciliationService } from "../services/reconciliation.service"
import { validateRequest } from "../middleware/validation.middleware"
import { authenticate as authMiddleware, authorize as checkPermission } from "../middleware/auth.middleware"
import { rateLimiter } from "../middleware/rate-limiter.middleware"
import { httpRequestsTotal, httpRequestDuration } from "../config/metrics"
import { logger } from "../config/logger"
import Joi from "joi"

const router = Router()
const reconciliationService = new ReconciliationService()

// 请求验证 schemas
const getRecordsSchema = Joi.object({
  status: Joi.string().valid("matched", "unmatched", "disputed", "resolved").optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  customerName: Joi.string().max(200).optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0),
})

const createRecordSchema = Joi.object({
  transactionDate: Joi.date().iso().required(),
  transactionType: Joi.string().valid("bank", "invoice", "payment", "refund").required(),
  amount: Joi.number().required().not(0),
  currency: Joi.string().length(3).required(),
  description: Joi.string().required().max(500),
  bankReference: Joi.string().max(100).optional(),
  invoiceNumber: Joi.string().max(50).optional(),
  customerName: Joi.string().max(200).optional(),
  category: Joi.string().max(50).required(),
  notes: Joi.string().max(1000).optional(),
})

const updateRecordSchema = Joi.object({
  status: Joi.string().valid("matched", "unmatched", "disputed", "resolved").optional(),
  notes: Joi.string().max(1000).optional(),
})

// 中间件：记录请求指标
const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000
    const route = req.route?.path || req.path

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    })

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode,
      },
      duration,
    )
  })

  next()
}

// 应用中间件
router.use(metricsMiddleware)
router.use(authMiddleware)

/**
 * @route   GET /api/reconciliation/records
 * @desc    获取对账记录列表
 * @access  Private (需要 reconciliation:read 权限)
 */
router.get(
  "/records",
  checkPermission(["reconciliation:read"]),
  rateLimiter({ windowMs: 60000, max: 100 }),
  validateRequest(getRecordsSchema, "query"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        customerName: req.query.customerName as string | undefined,
        limit: Number.parseInt(req.query.limit as string) || 50,
        offset: Number.parseInt(req.query.offset as string) || 0,
      }

      const result = await reconciliationService.getRecords(filters)

      res.json({
        success: true,
        data: result.records,
        pagination: {
          total: result.total,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: filters.offset + filters.limit < result.total,
        },
      })
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @route   GET /api/reconciliation/records/:id
 * @desc    获取单个对账记录详情
 * @access  Private (需要 reconciliation:read 权限)
 */
router.get(
  "/records/:id",
  checkPermission(["reconciliation:read"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await reconciliationService.getRecordById(req.params.id)

      if (!record) {
        return res.status(404).json({
          success: false,
          error: "Record not found",
        })
      }

      res.json({
        success: true,
        data: record,
      })
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @route   POST /api/reconciliation/records
 * @desc    创建对账记录
 * @access  Private (需要 reconciliation:write 权限)
 */
router.post(
  "/records",
  checkPermission(["reconciliation:write"]),
  rateLimiter({ windowMs: 60000, max: 50 }),
  validateRequest(createRecordSchema, "body"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id
      const recordData = {
        ...req.body,
        transactionDate: new Date(req.body.transactionDate),
        status: "unmatched",
        createdBy: userId,
      }

      const record = await reconciliationService.createRecord(recordData)

      logger.info("Reconciliation record created", {
        recordId: record.id,
        userId,
      })

      res.status(201).json({
        success: true,
        data: record,
      })
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @route   PATCH /api/reconciliation/records/:id
 * @desc    更新对账记录
 * @access  Private (需要 reconciliation:write 权限)
 */
router.patch(
  "/records/:id",
  checkPermission(["reconciliation:write"]),
  validateRequest(updateRecordSchema, "body"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id
      const record = await reconciliationService.updateRecord(req.params.id, req.body, userId)

      if (!record) {
        return res.status(404).json({
          success: false,
          error: "Record not found",
        })
      }

      res.json({
        success: true,
        data: record,
      })
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @route   POST /api/reconciliation/auto-reconcile
 * @desc    执行自动对账
 * @access  Private (需要 reconciliation:reconcile 权限)
 */
router.post(
  "/auto-reconcile",
  checkPermission(["reconciliation:reconcile"]),
  rateLimiter({ windowMs: 300000, max: 10 }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id
      const result = await reconciliationService.autoReconcile(userId)

      logger.info("Auto-reconciliation completed", {
        userId,
        result,
      })

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @route   GET /api/reconciliation/stats
 * @desc    获取对账统计信息
 * @access  Private (需要 reconciliation:read 权限)
 */
router.get(
  "/stats",
  checkPermission(["reconciliation:read"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await reconciliationService.getStats()

      res.json({
        success: true,
        data: stats,
      })
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @route   GET /api/reconciliation/exceptions
 * @desc    获取异常记录列表
 * @access  Private (需要 reconciliation:read 权限)
 */
router.get(
  "/exceptions",
  checkPermission(["reconciliation:read"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        severity: req.query.severity as string | undefined,
        limit: Number.parseInt(req.query.limit as string) || 50,
        offset: Number.parseInt(req.query.offset as string) || 0,
      }

      const result = await reconciliationService.getExceptions(filters)

      res.json({
        success: true,
        data: result.exceptions,
        pagination: {
          total: result.total,
          limit: filters.limit,
          offset: filters.offset,
        },
      })
    } catch (error) {
      next(error)
    }
  },
)

/**
 * @route   PATCH /api/reconciliation/exceptions/:id/resolve
 * @desc    解决异常
 * @access  Private (需要 reconciliation:resolve 权限)
 */
router.patch(
  "/exceptions/:id/resolve",
  checkPermission(["reconciliation:resolve"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id
      const { resolutionNotes } = req.body

      const exception = await reconciliationService.resolveException(req.params.id, resolutionNotes, userId)

      if (!exception) {
        return res.status(404).json({
          success: false,
          error: "Exception not found",
        })
      }

      res.json({
        success: true,
        data: exception,
      })
    } catch (error) {
      next(error)
    }
  },
)

export default router
