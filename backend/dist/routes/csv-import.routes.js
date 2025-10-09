"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const csv_import_service_1 = require("../services/csv-import.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limiter_middleware_1 = require("../middleware/rate-limiter.middleware");
const logger_1 = require("../config/logger");
const router = (0, express_1.Router)();
const csvImportService = new csv_import_service_1.CsvImportService();
// 配置 multer 用于文件上传
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
            cb(null, true);
        }
        else {
            cb(new Error("Only CSV files are allowed"));
        }
    },
});
router.use(auth_middleware_1.authenticate);
/**
 * @route   POST /api/csv-import/upload
 * @desc    上传并导入 CSV 文件
 * @access  Private (需要 reconciliation:import 权限)
 */
router.post("/upload", (0, auth_middleware_1.authorize)(["reconciliation:import"]), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 300000, max: 5 }), upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded",
            });
        }
        const userId = req.user.id;
        const result = await csvImportService.importCsv(req.file.buffer, req.file.originalname, userId);
        logger_1.logger.info("CSV import completed", {
            userId,
            fileName: req.file.originalname,
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
 * @route   GET /api/csv-import/batches
 * @desc    获取导入批次列表
 * @access  Private (需要 reconciliation:read 权限)
 */
router.get("/batches", (0, auth_middleware_1.authorize)(["reconciliation:read"]), async (req, res, next) => {
    try {
        const filters = {
            status: req.query.status,
            limit: Number.parseInt(req.query.limit) || 50,
            offset: Number.parseInt(req.query.offset) || 0,
        };
        const result = await csvImportService.getBatches(filters);
        res.json({
            success: true,
            data: result.batches,
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
 * @route   GET /api/csv-import/export-exceptions
 * @desc    导出异常记录为 CSV
 * @access  Private (需要 reconciliation:export 权限)
 */
router.get("/export-exceptions", (0, auth_middleware_1.authorize)(["reconciliation:export"]), async (req, res, next) => {
    try {
        const exceptionIds = req.query.ids?.split(",") || [];
        if (exceptionIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: "No exception IDs provided",
            });
        }
        const csvBuffer = await csvImportService.exportExceptions(exceptionIds);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="exceptions-${Date.now()}.csv"`);
        res.send(csvBuffer);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
