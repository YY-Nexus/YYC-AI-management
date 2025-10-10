"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reconciliation_service_cached_1 = require("../services/reconciliation.service.cached");
const cache_middleware_1 = require("../middleware/cache.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
// 请求验证 schemas
const reconciliationFiltersSchema = joi_1.default.object({
    status: joi_1.default.string().valid("pending", "matched", "exception", "resolved").optional(),
    type: joi_1.default.string().valid("payment", "refund", "transfer", "adjustment").optional(),
    dateFrom: joi_1.default.date().iso().optional(),
    dateTo: joi_1.default.date().iso().optional(),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    offset: joi_1.default.number().integer().min(0).default(0),
});
// 所有路由需要认证
router.use(auth_middleware_1.authenticate);
/**
 * @route   GET /api/reconciliation
 * @desc    获取对账记录列表（带缓存）
 * @access  Private (需要 reconciliation:read 权限)
 * @cache   5分钟
 */
router.get("/", (0, auth_middleware_1.authorize)(["reconciliation:read"]), (0, validation_middleware_1.validateRequest)(reconciliationFiltersSchema, "query"), (0, cache_middleware_1.cacheMiddleware)({
    ttl: 300, // 5分钟
    prefix: "reconciliation",
    keyGenerator: (req) => {
        const { status, type, dateFrom, dateTo, limit, offset } = req.query;
        const parts = ["list"];
        if (status)
            parts.push(`status:${status}`);
        if (type)
            parts.push(`type:${type}`);
        if (dateFrom)
            parts.push(`from:${dateFrom}`);
        if (dateTo)
            parts.push(`to:${dateTo}`);
        if (limit)
            parts.push(`limit:${limit}`);
        if (offset)
            parts.push(`offset:${offset}`);
        return parts.join(":");
    },
}), async (req, res, next) => {
    try {
        const filters = req.query;
        const result = await reconciliation_service_cached_1.cachedReconciliationService.getRecords(filters);
        res.json({
            success: true,
            data: result.records,
            pagination: {
                total: result.total,
                limit: filters.limit || 20,
                offset: filters.offset || 0,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/reconciliation/stats
 * @desc    获取对账统计（带缓存）
 * @access  Private
 * @cache   1分钟
 */
router.get("/stats", (0, auth_middleware_1.authorize)(["reconciliation:read"]), (0, cache_middleware_1.cacheMiddleware)({
    ttl: 60, // 1分钟
    prefix: "reconciliation",
    keyGenerator: () => "stats:all",
}), async (req, res, next) => {
    try {
        const stats = await reconciliation_service_cached_1.cachedReconciliationService.getStats();
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
 * @route   GET /api/reconciliation/:id
 * @desc    获取单条对账记录（带缓存）
 * @access  Private
 * @cache   5分钟
 */
router.get("/:id", (0, auth_middleware_1.authorize)(["reconciliation:read"]), (0, cache_middleware_1.cacheMiddleware)({
    ttl: 300,
    prefix: "reconciliation",
    keyGenerator: (req) => `record:${req.params.id}`,
}), async (req, res, next) => {
    try {
        const record = await reconciliation_service_cached_1.cachedReconciliationService.getRecordById(req.params.id);
        if (!record) {
            return res.status(404).json({
                success: false,
                error: "Reconciliation record not found",
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
 * @route   POST /api/reconciliation
 * @desc    创建对账记录（清除缓存）
 * @access  Private
 */
router.post("/", (0, auth_middleware_1.authorize)(["reconciliation:write"]), (0, cache_middleware_1.invalidateCacheMiddleware)({
    patterns: ["list:*", "stats:*"],
    prefix: "reconciliation",
}), async (req, res, next) => {
    try {
        const record = await reconciliation_service_cached_1.cachedReconciliationService.createRecord(req.body);
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
 * @route   PUT /api/reconciliation/:id
 * @desc    更新对账记录（清除缓存）
 * @access  Private
 */
router.put("/:id", (0, auth_middleware_1.authorize)(["reconciliation:write"]), (0, cache_middleware_1.invalidateCacheMiddleware)({
    patterns: (req) => [`record:${req.params.id}`, "list:*", "stats:*"],
    prefix: "reconciliation",
}), async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const record = await reconciliation_service_cached_1.cachedReconciliationService.updateRecord(req.params.id, req.body, userId);
        if (!record) {
            return res.status(404).json({
                success: false,
                error: "Reconciliation record not found",
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
 * @route   POST /api/reconciliation/match
 * @desc    批量匹配对账（清除所有缓存）
 * @access  Private
 */
router.post("/match", (0, auth_middleware_1.authorize)(["reconciliation:reconcile"]), (0, cache_middleware_1.invalidateCacheMiddleware)({
    patterns: ["*"],
    prefix: "reconciliation",
}), async (req, res, next) => {
    try {
        const result = await reconciliation_service_cached_1.cachedReconciliationService.bulkMatch(req.body);
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
 * @route   POST /api/reconciliation/:id/resolve
 * @desc    处理异常（清除缓存）
 * @access  Private
 */
router.post("/:id/resolve", (0, auth_middleware_1.authorize)(["reconciliation:resolve"]), (0, cache_middleware_1.invalidateCacheMiddleware)({
    patterns: (req) => [`record:${req.params.id}`, "list:*", "stats:*"],
    prefix: "reconciliation",
}), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const record = await reconciliation_service_cached_1.cachedReconciliationService.resolveException(req.params.id, req.body.resolution, userId);
        if (!record) {
            return res.status(404).json({
                success: false,
                error: "Reconciliation record not found",
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
module.exports = router;
