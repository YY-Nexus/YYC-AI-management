"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ticket_service_1 = require("../services/ticket.service");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limiter_middleware_1 = require("../middleware/rate-limiter.middleware");
const circuit_breaker_middleware_1 = require("../middleware/circuit-breaker.middleware");
const logger_1 = require("../config/logger");
const joi_1 = __importDefault(require("joi"));
const router = (0, express_1.Router)();
const ticketService = new ticket_service_1.TicketService();
// 请求验证 schemas
const createTicketSchema = joi_1.default.object({
    title: joi_1.default.string().required().max(200),
    description: joi_1.default.string().required().max(2000),
    category: joi_1.default.string().required(),
    priority: joi_1.default.string().valid("low", "medium", "high", "urgent").required(),
    customerName: joi_1.default.string().required().max(200),
    customerEmail: joi_1.default.string().email().required(),
    customerPhone: joi_1.default.string().max(20).optional(),
});
const updateTicketSchema = joi_1.default.object({
    status: joi_1.default.string().valid("open", "in-progress", "pending", "resolved", "closed").optional(),
    priority: joi_1.default.string().valid("low", "medium", "high", "urgent").optional(),
    assignedTo: joi_1.default.string().uuid().optional(),
    notes: joi_1.default.string().max(1000).optional(),
});
const addMessageSchema = joi_1.default.object({
    content: joi_1.default.string().required().max(2000),
    isInternal: joi_1.default.boolean().default(false),
});
router.use(auth_middleware_1.authenticate);
/**
 * @route   GET /api/tickets
 * @desc    获取工单列表
 * @access  Private (需要 tickets:read 权限)
 */
router.get("/", (0, auth_middleware_1.authorize)(["tickets:read"]), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 100 }), (0, circuit_breaker_middleware_1.circuitBreaker)({ threshold: 0.5, timeout: 30000, resetTimeout: 60000 }), async (req, res, next) => {
    try {
        const filters = {
            status: req.query.status,
            priority: req.query.priority,
            assignedTo: req.query.assignedTo,
            limit: Number.parseInt(req.query.limit) || 50,
            offset: Number.parseInt(req.query.offset) || 0,
        };
        const result = await ticketService.getTickets(filters);
        res.json({
            success: true,
            data: result.tickets,
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
 * @route   GET /api/tickets/:id
 * @desc    获取工单详情
 * @access  Private (需要 tickets:read 权限)
 */
router.get("/:id", (0, auth_middleware_1.authorize)(["tickets:read"]), (0, circuit_breaker_middleware_1.circuitBreaker)({ threshold: 0.5, timeout: 30000, resetTimeout: 60000 }), async (req, res, next) => {
    try {
        const ticket = await ticketService.getTicketById(req.params.id);
        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: "Ticket not found",
            });
        }
        res.json({
            success: true,
            data: ticket,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/tickets
 * @desc    创建工单
 * @access  Private (需要 tickets:create 权限)
 */
router.post("/", (0, auth_middleware_1.authorize)(["tickets:create"]), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 20 }), (0, validation_middleware_1.validateRequest)(createTicketSchema, "body"), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const ticketData = {
            ...req.body,
            createdBy: userId,
        };
        const ticket = await ticketService.createTicket(ticketData);
        logger_1.logger.info("Ticket created", {
            ticketId: ticket.id,
            userId,
        });
        res.status(201).json({
            success: true,
            data: ticket,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   PATCH /api/tickets/:id
 * @desc    更新工单
 * @access  Private (需要 tickets:update 权限)
 */
router.patch("/:id", (0, auth_middleware_1.authorize)(["tickets:update"]), (0, validation_middleware_1.validateRequest)(updateTicketSchema, "body"), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const ticket = await ticketService.updateTicket(req.params.id, req.body, userId);
        if (!ticket) {
            return res.status(404).json({
                success: false,
                error: "Ticket not found",
            });
        }
        res.json({
            success: true,
            data: ticket,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/tickets/:id/messages
 * @desc    添加工单消息
 * @access  Private (需要 tickets:message 权限)
 */
router.post("/:id/messages", (0, auth_middleware_1.authorize)(["tickets:message"]), (0, rate_limiter_middleware_1.rateLimiter)({ windowMs: 60000, max: 50 }), (0, validation_middleware_1.validateRequest)(addMessageSchema, "body"), async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userName = req.user.name;
        const message = await ticketService.addMessage(req.params.id, {
            authorId: userId,
            authorName: userName,
            content: req.body.content,
            isInternal: req.body.isInternal,
        });
        res.status(201).json({
            success: true,
            data: message,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/tickets/stats
 * @desc    获取工单统计
 * @access  Private (需要 tickets:read 权限)
 */
router.get("/stats", (0, auth_middleware_1.authorize)(["tickets:read"]), async (req, res, next) => {
    try {
        const stats = await ticketService.getStats();
        res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
