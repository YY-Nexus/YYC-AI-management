import express from 'express';
import { SecurityLogController } from '../controllers/security-log.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = express.Router();

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
router.get('/login-history', SecurityLogController.getLoginHistory);

/**
 * @route GET /api/security/activity-logs
 * @desc 查询用户活动日志
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/activity-logs', SecurityLogController.getUserActivityLogs);

/**
 * @route GET /api/security/alerts
 * @desc 查询安全警报
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/alerts', SecurityLogController.getSecurityAlerts);

/**
 * @route PATCH /api/security/alerts/:alertId/resolve
 * @desc 解决安全警报
 * @access Private (需要管理员或安全分析师权限)
 */
router.patch('/alerts/:alertId/resolve', SecurityLogController.resolveSecurityAlert);

/**
 * @route GET /api/security/statistics
 * @desc 获取安全统计信息
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/statistics', SecurityLogController.getSecurityStatistics);

/**
 * @route GET /api/security/users/:userId/report
 * @desc 获取用户安全报告
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/users/:userId/report', SecurityLogController.getUserSecurityReport);

/**
 * @route GET /api/security/suspicious-logins
 * @desc 获取异常登录尝试
 * @access Private (需要管理员或安全分析师权限)
 */
router.get('/suspicious-logins', SecurityLogController.getSuspiciousLogins);

export default router;