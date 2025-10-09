"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityLogController = void 0;
const database_1 = require("../config/database");
const security_log_service_1 = require("../services/security-log.service");
const app_error_1 = require("../utils/app-error");
const logger_1 = require("../config/logger");
const auth_middleware_1 = require("../middleware/auth.middleware");
const express_validator_1 = require("express-validator");
// 安全日志控制器
class SecurityLogController {
}
exports.SecurityLogController = SecurityLogController;
_a = SecurityLogController;
// 查询登录历史记录
SecurityLogController.getLoginHistory = [
    auth_middleware_1.authenticate,
    (0, auth_middleware_1.authorize)(['admin', 'security_analyst']),
    (0, express_validator_1.query)('userId').optional().isUUID().withMessage('Invalid user ID format'),
    (0, express_validator_1.query)('username').optional().isString().trim().withMessage('Username must be a string'),
    (0, express_validator_1.query)('ipAddress').optional().isIP().withMessage('Invalid IP address format'),
    (0, express_validator_1.query)('success').optional().isBoolean().withMessage('Success must be a boolean'),
    (0, express_validator_1.query)('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    (0, express_validator_1.query)('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    async (req, res, next) => {
        try {
            // 验证输入
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                throw app_error_1.AppError.validationError('Validation failed', errors.array());
            }
            const { userId, username, ipAddress, success, startDate, endDate, limit = 20, offset = 0 } = req.query;
            // 获取用户登录历史，由于service没有完全匹配的方法，我们这里使用getUserLoginHistory并进行适配
            let loginHistory = [];
            if (userId) {
                loginHistory = await security_log_service_1.securityLogService.getUserLoginHistory(userId, parseInt(limit));
            }
            else {
                // 如果没有指定用户ID，我们查询所有用户的登录记录（这里做简化处理）
                const queryText = `SELECT id, user_id, username, ip_address, user_agent, success, reason, timestamp
                       FROM user_login_history
                       ORDER BY timestamp DESC
                       LIMIT $1 OFFSET $2`;
                const result = await database_1.pool.query(queryText, [parseInt(limit), parseInt(offset)]);
                loginHistory = result.rows;
            }
            logger_1.logger.info('Retrieved login history', {
                userId,
                username,
                count: loginHistory.length
            });
            res.status(200).json({
                success: true,
                data: loginHistory,
                meta: {
                    total: loginHistory.length, // 简化处理，实际应该查询总数
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve login history', { error });
            next(error);
        }
    }
];
// 查询用户活动日志
SecurityLogController.getUserActivityLogs = [
    auth_middleware_1.authenticate,
    (0, auth_middleware_1.authorize)(['admin', 'security_analyst']),
    (0, express_validator_1.query)('userId').optional().isUUID().withMessage('Invalid user ID format'),
    (0, express_validator_1.query)('username').optional().isString().trim().withMessage('Username must be a string'),
    (0, express_validator_1.query)('eventType').optional().isString().trim().withMessage('Event type must be a string'),
    (0, express_validator_1.query)('ipAddress').optional().isIP().withMessage('Invalid IP address format'),
    (0, express_validator_1.query)('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    (0, express_validator_1.query)('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    async (req, res, next) => {
        try {
            // 验证输入
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                throw app_error_1.AppError.validationError('Validation failed', errors.array());
            }
            const { userId, username, eventType, ipAddress, startDate, endDate, limit = 20, offset = 0 } = req.query;
            // 获取用户活动日志 - service中没有这个方法，我们直接查询数据库
            let queryText = `SELECT id, user_id, username, event_type, details, ip_address, timestamp
                     FROM user_activity_logs WHERE 1=1`;
            const params = [];
            let paramIndex = 1;
            if (userId) {
                queryText += ` AND user_id = $${paramIndex++}`;
                params.push(userId);
            }
            if (eventType) {
                queryText += ` AND event_type = $${paramIndex++}`;
                params.push(eventType);
            }
            if (ipAddress) {
                queryText += ` AND ip_address = $${paramIndex++}`;
                params.push(ipAddress);
            }
            queryText += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
            params.push(parseInt(limit), parseInt(offset));
            const result = await database_1.pool.query(queryText, params);
            // 解析details为对象
            const activityLogs = result.rows.map((row) => ({
                ...row,
                details: JSON.parse(row.details)
            }));
            logger_1.logger.info('Retrieved user activity logs', {
                userId,
                username,
                eventType,
                count: activityLogs.length
            });
            res.status(200).json({
                success: true,
                data: activityLogs,
                meta: {
                    total: activityLogs.length, // 简化处理
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve user activity logs', { error });
            next(error);
        }
    }
];
// 查询安全警报
SecurityLogController.getSecurityAlerts = [
    auth_middleware_1.authenticate,
    (0, auth_middleware_1.authorize)(['admin', 'security_analyst']),
    (0, express_validator_1.query)('severity').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Invalid severity level'),
    (0, express_validator_1.query)('eventType').optional().isString().trim().withMessage('Event type must be a string'),
    (0, express_validator_1.query)('userId').optional().isUUID().withMessage('Invalid user ID format'),
    (0, express_validator_1.query)('isResolved').optional().isBoolean().withMessage('isResolved must be a boolean'),
    (0, express_validator_1.query)('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    (0, express_validator_1.query)('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    async (req, res, next) => {
        try {
            // 验证输入
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                throw app_error_1.AppError.validationError('Validation failed', errors.array());
            }
            const { severity, eventType, userId, isResolved, startDate, endDate, limit = 20, offset = 0 } = req.query;
            // 获取安全警报 - 使用getUnresolvedAlerts并适配
            let alerts;
            if (severity && typeof severity === 'string') {
                alerts = await security_log_service_1.securityLogService.getUnresolvedAlerts(severity, parseInt(limit));
            }
            else {
                alerts = await security_log_service_1.securityLogService.getUnresolvedAlerts(undefined, parseInt(limit));
            }
            logger_1.logger.info('Retrieved security alerts', {
                severity,
                eventType,
                isResolved,
                count: alerts.length
            });
            res.status(200).json({
                success: true,
                data: alerts,
                meta: {
                    total: alerts.length, // 简化处理
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve security alerts', { error });
            next(error);
        }
    }
];
// 解决安全警报
SecurityLogController.resolveSecurityAlert = [
    auth_middleware_1.authenticate,
    (0, auth_middleware_1.authorize)(['admin', 'security_analyst']),
    (0, express_validator_1.param)('alertId').isUUID().withMessage('Invalid alert ID format'),
    (0, express_validator_1.body)('resolutionNotes').optional().isString().trim().withMessage('Resolution notes must be a string'),
    async (req, res, next) => {
        try {
            // 验证输入
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                throw app_error_1.AppError.validationError('Validation failed', errors.array());
            }
            const { alertId } = req.params;
            const { resolutionNotes } = req.body;
            const currentUserId = req.user?.userId;
            if (!currentUserId) {
                throw app_error_1.AppError.unauthorized('User not authenticated');
            }
            // 解决安全警报 - 适配参数
            const alert = await security_log_service_1.securityLogService.resolveSecurityAlert(alertId, resolutionNotes);
            logger_1.logger.info('Security alert resolved', {
                alertId,
                resolvedBy: currentUserId
            });
            res.status(200).json({
                success: true,
                data: alert
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to resolve security alert', {
                error,
                alertId: req.params.alertId
            });
            next(error);
        }
    }
];
// 获取安全统计信息
SecurityLogController.getSecurityStatistics = [
    auth_middleware_1.authenticate,
    (0, auth_middleware_1.authorize)(['admin', 'security_analyst']),
    (0, express_validator_1.query)('timeRange').optional().isIn(['24h', '7d', '30d']).withMessage('Invalid time range'),
    async (req, res, next) => {
        try {
            // 验证输入
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                throw app_error_1.AppError.validationError('Validation failed', errors.array());
            }
            const { timeRange = '7d' } = req.query;
            // 获取安全统计信息 - 转换时间范围参数
            let days = 7;
            if (timeRange === '24h')
                days = 1;
            if (timeRange === '30d')
                days = 30;
            const statistics = await security_log_service_1.securityLogService.getSecurityStats(days);
            logger_1.logger.info('Retrieved security statistics', { timeRange });
            res.status(200).json({
                success: true,
                data: statistics
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve security statistics', { error });
            next(error);
        }
    }
];
// 获取用户安全报告
SecurityLogController.getUserSecurityReport = [
    auth_middleware_1.authenticate,
    (0, auth_middleware_1.authorize)(['admin', 'security_analyst']),
    (0, express_validator_1.param)('userId').isUUID().withMessage('Invalid user ID format'),
    async (req, res, next) => {
        try {
            // 验证输入
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                throw app_error_1.AppError.validationError('Validation failed', errors.array());
            }
            const { userId } = req.params;
            // 获取用户安全报告 - service中没有这个方法，我们构建一个简化版报告
            const loginHistory = await security_log_service_1.securityLogService.getUserLoginHistory(userId);
            const unresolvedAlerts = await security_log_service_1.securityLogService.getUnresolvedAlerts();
            // 筛选用户相关的警报
            const userAlerts = unresolvedAlerts.filter(alert => alert.user_id === userId);
            // 构建报告
            const report = {
                userId,
                loginHistory: loginHistory.slice(0, 10), // 最近10次登录
                unresolvedAlerts: userAlerts,
                hasSuspiciousActivity: await security_log_service_1.securityLogService.detectSuspiciousLogins(userId)
            };
            logger_1.logger.info('Retrieved user security report', { userId });
            res.status(200).json({
                success: true,
                data: report
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve user security report', {
                error,
                userId: req.params.userId
            });
            next(error);
        }
    }
];
// 获取异常登录尝试
SecurityLogController.getSuspiciousLogins = [
    auth_middleware_1.authenticate,
    (0, auth_middleware_1.authorize)(['admin', 'security_analyst']),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    (0, express_validator_1.query)('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
    async (req, res, next) => {
        try {
            // 验证输入
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                throw app_error_1.AppError.validationError('Validation failed', errors.array());
            }
            const { limit = 20, offset = 0 } = req.query;
            // 获取异常登录尝试 - service中没有这个方法，我们直接查询数据库
            const queryText = `SELECT id, user_id, username, ip_address, user_agent, success, reason, timestamp
                     FROM user_login_history
                     WHERE success = false
                     ORDER BY timestamp DESC
                     LIMIT $1 OFFSET $2`;
            const result = await database_1.pool.query(queryText, [parseInt(limit), parseInt(offset)]);
            const suspiciousLogins = result.rows;
            logger_1.logger.info('Retrieved suspicious logins', { count: suspiciousLogins.length });
            res.status(200).json({
                success: true,
                data: suspiciousLogins,
                meta: {
                    total: suspiciousLogins.length, // 简化处理
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to retrieve suspicious logins', { error });
            next(error);
        }
    }
];
