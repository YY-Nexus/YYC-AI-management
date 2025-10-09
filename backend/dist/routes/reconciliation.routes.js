"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reconciliation_service_1 = require("../services/reconciliation.service");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limiter_middleware_1 = require("../middleware/rate-limiter.middleware");
const metrics_1 = require("../config/metrics");
const logger_1 = require("../config/logger");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
const reconciliationService = new reconciliation_service_1.ReconciliationService();
// 请求验证 schemas
const getRecordsSchema = joi_1.default.object({
    status: joi_1.default.string().valid("matched", "unmatched", "disputed", "resolved").optional(),
    startDate: joi_1.default.date().iso().optional(),
    endDate: joi_1.default.date().iso().optional(),
    customerName: joi_1.default.string().max(200).optional(),
    limit: joi_1.default.number().integer().min(1).max(100).default(50),
    offset: joi_1.default.number().integer().min(0).default(0),
});
const createRecordSchema = joi_1.default.object({
    transactionDate: joi_1.default.date().iso().required(),
    transactionType: joi_1.default.string().valid("bank", "invoice", "payment", "refund").required(),
    amount: joi_1.default.number().required().not(0),
    currency: joi_1.default.string().length(3).required(),
    description: joi_1.default.string().required().max(500),
    bankReference: joi_1.default.string().max(100).optional(),
    invoiceNumber: joi_1.default.string().max(50).optional(),
    customerName: joi_1.default.string().max(200).optional(),
    category: joi_1.default.string().max(50).required(),
    notes: joi_1.default.string().max(1000).optional(),
});
const updateRecordSchema = joi_1.default.object({
    status: joi_1.default.string().valid("matched", "unmatched", "disputed", "resolved").optional(),
    notes: joi_1.default.string().max(1000).optional(),
});
// 中间件：记录请求指标
const metricsMiddleware = (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;
        metrics_1.httpRequestsTotal.inc({
            method: req.method,
            route,
            status_code: res.statusCode,
        });
        metrics_1.httpRequestDuration.observe({
            method: req.method,
            route,
            status_code: res.statusCode,
        }, duration);
    });
    next();
};
// 应用中间件
router.use(metricsMiddleware);
router.use(auth_middleware_1.authenticate);
/**
 * @route   GET /api/reconciliation/records
 * @desc    获取对账记录列表
 * @access  Private (需要 reconciliation:read 权限)
 */
router.get("/records", (0, auth_middleware_1.authorize)(["reconciliation:read"]), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 100 }), (0, validation_middleware_1.validateRequest)(getRecordsSchema, "query"), async (req, res, next) => {
    try {
        const filters = {
            status: req.query.status,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            customerName: req.query.customerName,
            limit: Number.parseInt(req.query.limit) || 50,
            offset: Number.parseInt(req.query.offset) || 0,
        };
        const result = await reconciliationService.getRecords(filters);
        res.json({
            success: true,
            data: result.records,
            pagination: {
                total: result.total,
                limit: filters.limit,
                offset: filters.offset,
                hasMore: filters.offset + filters.limit < result.total,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/reconciliation/records/:id
 * @desc    获取单个对账记录详情
 * @access  Private (需要 reconciliation:read 权限)
 */
router.get("/records/:id", (0, auth_middleware_1.authorize)(["reconciliation:read"]), async (req, res, next) => {
    try {
        const record = await reconciliationService.getRecordById(req.params.id);
        if (!record) {
            return res.status(404).json({
                success: false,
                error: "Record not found",
            });
        }
        res.json({
            success: true,
            data: record,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/reconciliation/records
 * @desc    创建对账记录
 * @access  Private (需要 reconciliation:write 权限)
 */
router.post("/records", (0, auth_middleware_1.authorize)(["reconciliation:write"]), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 50 }), (0, validation_middleware_1.validateRequest)(createRecordSchema, "body"), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const recordData = {
            ...req.body,
            transactionDate: new Date(req.body.transactionDate),
            status: "unmatched",
            createdBy: userId,
        };
        const record = await reconciliationService.createRecord(recordData);
        logger_1.logger.info("Reconciliation record created", {
            recordId: record.id,
            userId,
        });
        res.status(201).json({
            success: true,
            data: record,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   PATCH /api/reconciliation/records/:id
 * @desc    更新对账记录
 * @access  Private (需要 reconciliation:write 权限)
 */
router.patch("/records/:id", (0, auth_middleware_1.authorize)(["reconciliation:write"]), (0, validation_middleware_1.validateRequest)(updateRecordSchema, "body"), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const record = await reconciliationService.updateRecord(req.params.id, req.body, userId);
        if (!record) {
            return res.status(404).json({
                success: false,
                error: "Record not found",
            });
        }
        res.json({
            success: true,
            data: record,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/reconciliation/auto-reconcile
 * @desc    执行自动对账
 * @access  Private (需要 reconciliation:reconcile 权限)
 */
router.post("/auto-reconcile", (0, auth_middleware_1.authorize)(["reconciliation:reconcile"]), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 300000, max: 10 }), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await reconciliationService.autoReconcile(userId);
        logger_1.logger.info("Auto-reconciliation completed", {
            userId,
            result,
        });
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/reconciliation/stats
 * @desc    获取对账统计信息
 * @access  Private (需要 reconciliation:read 权限)
 */
router.get("/stats", (0, auth_middleware_1.authorize)(["reconciliation:read"]), async (req, res, next) => {
    try {
        const stats = await reconciliationService.getStats();
        res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/reconciliation/exceptions
 * @desc    获取异常记录列表
 * @access  Private (需要 reconciliation:read 权限)
 */
router.get("/exceptions", (0, auth_middleware_1.authorize)(["reconciliation:read"]), async (req, res, next) => {
    try {
        const filters = {
            status: req.query.status,
            severity: req.query.severity,
            limit: Number.parseInt(req.query.limit) || 50,
            offset: Number.parseInt(req.query.offset) || 0,
        };
        const result = await reconciliationService.getExceptions(filters);
        res.json({
            success: true,
            data: result.exceptions,
            pagination: {
                total: result.total,
                limit: filters.limit,
                offset: filters.offset,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   PATCH /api/reconciliation/exceptions/:id/resolve
 * @desc    解决异常
 * @access  Private (需要 reconciliation:resolve 权限)
 */
router.patch("/exceptions/:id/resolve", (0, auth_middleware_1.authorize)(["reconciliation:resolve"]), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { resolutionNotes } = req.body;
        const exception = await reconciliationService.resolveException(req.params.id, resolutionNotes, userId);
        if (!exception) {
            return res.status(404).json({
                success: false,
                error: "Exception not found",
            });
        }
        res.json({
            success: true,
            data: exception,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
