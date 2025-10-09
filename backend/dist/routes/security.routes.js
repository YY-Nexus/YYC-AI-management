"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const security_log_controller_1 = require("../controllers/security-log.controller");
const router = express_1.default.Router();
/**
 * 安全日志相关路由
 * 这些路由用于查询和管理系统安全日志、监控用户活动和处理安全警报
 * 所有路由都需要管理员或安全分析师权限
 */
/**
 * @route GET /api/security/login-history
 * @desc 查询用户登录历史记录
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/login-history', security_log_controller_1.SecurityLogController.getLoginHistory);
/**
 * @route GET /api/security/activity-logs
 * @desc 查询用户活动日志
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/activity-logs', security_log_controller_1.SecurityLogController.getUserActivityLogs);
/**
 * @route GET /api/security/alerts
 * @desc 查询安全警报
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/alerts', security_log_controller_1.SecurityLogController.getSecurityAlerts);
/**
 * @route PATCH /api/security/alerts/:alertId/resolve
 * @desc 解决安全警报
 * @access Private (需要管理员或安全分析师权限)
 */
router.patch('/alerts/:alertId/resolve', security_log_controller_1.SecurityLogController.resolveSecurityAlert);
/**
 * @route GET /api/security/statistics
 * @desc 获取安全统计信息
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/statistics', security_log_controller_1.SecurityLogController.getSecurityStatistics);
/**
 * @route GET /api/security/users/:userId/report
 * @desc 获取用户安全报告
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/users/:userId/report', security_log_controller_1.SecurityLogController.getUserSecurityReport);
/**
 * @route GET /api/security/suspicious-logins
 * @desc 获取异常登录尝试
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/suspicious-logins', security_log_controller_1.SecurityLogController.getSuspiciousLogins);
exports.default = router;
