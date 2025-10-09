"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityLogService = exports.SecurityLogService = exports.SecuritySeverity = exports.SecurityEventType = void 0;
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const app_error_1 = require("../utils/app-error");
const error_codes_1 = require("../constants/error-codes");
// 安全事件类型定义
var SecurityEventType;
(function (SecurityEventType) {
    SecurityEventType["USER_LOGIN"] = "USER_LOGIN";
    SecurityEventType["USER_LOGOUT"] = "USER_LOGOUT";
    SecurityEventType["PASSWORD_CHANGE"] = "PASSWORD_CHANGE";
    SecurityEventType["PASSWORD_RESET"] = "PASSWORD_RESET";
    SecurityEventType["FAILED_LOGIN"] = "FAILED_LOGIN";
    SecurityEventType["UNAUTHORIZED_ACCESS"] = "UNAUTHORIZED_ACCESS";
    SecurityEventType["PRIVILEGE_ESCALATION"] = "PRIVILEGE_ESCALATION";
    SecurityEventType["ACCOUNT_LOCKED"] = "ACCOUNT_LOCKED";
    SecurityEventType["ACCOUNT_UNLOCKED"] = "ACCOUNT_UNLOCKED";
    SecurityEventType["API_KEY_CREATED"] = "API_KEY_CREATED";
    SecurityEventType["API_KEY_REVOKED"] = "API_KEY_REVOKED";
    SecurityEventType["SENSITIVE_DATA_ACCESS"] = "SENSITIVE_DATA_ACCESS";
    SecurityEventType["CONFIGURATION_CHANGE"] = "CONFIGURATION_CHANGE";
    SecurityEventType["SECURITY_POLICY_VIOLATION"] = "SECURITY_POLICY_VIOLATION";
})(SecurityEventType || (exports.SecurityEventType = SecurityEventType = {}));
// 安全日志严重程度
var SecuritySeverity;
(function (SecuritySeverity) {
    SecuritySeverity["LOW"] = "LOW";
    SecuritySeverity["MEDIUM"] = "MEDIUM";
    SecuritySeverity["HIGH"] = "HIGH";
    SecuritySeverity["CRITICAL"] = "CRITICAL";
})(SecuritySeverity || (exports.SecuritySeverity = SecuritySeverity = {}));
class SecurityLogService {
    constructor() {
        logger_1.logger.info('Security Log Service initialized');
    }
    /**
     * 记录用户登录尝试
     */
    async logLoginAttempt(user_id, username, ip_address, user_agent, success, reason) {
        try {
            logger_1.logger.info('Logging login attempt', { username, success });
            const result = await database_1.pool.query(`INSERT INTO user_login_history (user_id, username, ip_address, user_agent, success, reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, username, ip_address, user_agent, success, reason, timestamp`, [user_id, username, ip_address, user_agent, success, reason]);
            const record = result.rows[0];
            logger_1.logger.info('Login attempt logged successfully', { record_id: record.id });
            // 如果登录失败，创建安全警报
            if (!success) {
                await this.createSecurityAlert(SecurityEventType.FAILED_LOGIN, SecuritySeverity.MEDIUM, { username, reason, ip_address, user_agent }, user_id);
            }
            return record;
        }
        catch (error) {
            logger_1.logger.error('Failed to log login attempt', { error });
            throw app_error_1.AppError.internal('Failed to log login attempt', error_codes_1.ErrorCode.DATABASE_ERROR);
        }
    }
    /**
     * 记录用户活动
     */
    async logUserActivity(user_id, username, event_type, details, ip_address) {
        try {
            logger_1.logger.info('Logging user activity', { username, event_type });
            // 序列化details对象
            const serializedDetails = JSON.stringify(details);
            const result = await database_1.pool.query(`INSERT INTO user_activity_logs (user_id, username, event_type, details, ip_address)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, username, event_type, details, ip_address, timestamp`, [user_id, username, event_type, serializedDetails, ip_address]);
            const log = result.rows[0];
            // 解析details为对象
            log.details = JSON.parse(log.details);
            logger_1.logger.info('User activity logged successfully', { log_id: log.id });
            // 对于高风险事件，创建安全警报
            if ([
                SecurityEventType.PASSWORD_CHANGE,
                SecurityEventType.PRIVILEGE_ESCALATION,
                SecurityEventType.API_KEY_CREATED,
                SecurityEventType.SENSITIVE_DATA_ACCESS
            ].includes(event_type)) {
                await this.createSecurityAlert(event_type, SecuritySeverity.HIGH, details, user_id, username, ip_address);
            }
            return log;
        }
        catch (error) {
            logger_1.logger.error('Failed to log user activity', { error });
            throw app_error_1.AppError.internal('Failed to log user activity', error_codes_1.ErrorCode.DATABASE_ERROR);
        }
    }
    /**
     * 创建安全警报
     */
    async createSecurityAlert(event_type, severity, details, user_id, username, ip_address) {
        try {
            logger_1.logger.info('Creating security alert', { event_type, severity });
            // 序列化details对象
            const serializedDetails = JSON.stringify(details);
            const result = await database_1.pool.query(`INSERT INTO security_alerts (event_type, severity, details, user_id, username, ip_address, is_resolved)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         RETURNING id, event_type, severity, details, user_id, username, ip_address, is_resolved, created_at, resolved_at`, [event_type, severity, serializedDetails, user_id, username, ip_address]);
            const alert = result.rows[0];
            // 解析details为对象
            alert.details = JSON.parse(alert.details);
            logger_1.logger.info('Security alert created successfully', { alert_id: alert.id });
            // 对于严重警报，记录到主要日志系统
            if (severity === SecuritySeverity.CRITICAL) {
                logger_1.logger.error('Critical security alert', {
                    alert_id: alert.id,
                    event_type,
                    user_id,
                    username,
                    ip_address,
                    details
                });
            }
            return alert;
        }
        catch (error) {
            logger_1.logger.error('Failed to create security alert', { error });
            throw app_error_1.AppError.internal('Failed to create security alert', error_codes_1.ErrorCode.DATABASE_ERROR);
        }
    }
    /**
     * 解决安全警报
     */
    async resolveSecurityAlert(alert_id, resolution_notes) {
        try {
            logger_1.logger.info('Resolving security alert', { alert_id });
            const result = await database_1.pool.query(`UPDATE security_alerts
         SET is_resolved = true,
             resolved_at = NOW(),
             resolution_notes = $2
         WHERE id = $1
         RETURNING id, event_type, severity, details, user_id, username, ip_address, is_resolved, created_at, resolved_at`, [alert_id, resolution_notes]);
            if (result.rowCount === 0) {
                throw new Error('Security alert not found');
            }
            const alert = result.rows[0];
            // 解析details为对象
            alert.details = JSON.parse(alert.details);
            logger_1.logger.info('Security alert resolved successfully', { alert_id });
            return alert;
        }
        catch (error) {
            logger_1.logger.error('Failed to resolve security alert', { alert_id, error });
            throw app_error_1.AppError.internal('Failed to resolve security alert', error_codes_1.ErrorCode.DATABASE_ERROR);
        }
    }
    /**
     * 获取安全统计信息
     */
    async getSecurityStats(days = 7) {
        try {
            logger_1.logger.info('Fetching security statistics', { days });
            // 获取登录统计
            const loginStatsResult = await database_1.pool.query(`SELECT 
           COUNT(*) FILTER (WHERE success = true) as total_logins,
           COUNT(*) FILTER (WHERE success = false) as failed_logins
         FROM user_login_history
         WHERE timestamp >= NOW() - INTERVAL '${days} days'`);
            // 获取警报统计
            const alertStatsResult = await database_1.pool.query(`SELECT 
           COUNT(*) FILTER (WHERE is_resolved = false) as active_alerts,
           COUNT(*) FILTER (WHERE is_resolved = false AND severity = 'CRITICAL') as critical_alerts
         FROM security_alerts
         WHERE created_at >= NOW() - INTERVAL '${days} days'`);
            // 获取最近安全事件
            const eventsResult = await database_1.pool.query(`SELECT COUNT(*) as recent_security_events
         FROM user_activity_logs
         WHERE timestamp >= NOW() - INTERVAL '${days} days'`);
            const loginStats = loginStatsResult.rows[0];
            const alertStats = alertStatsResult.rows[0];
            const eventsStats = eventsResult.rows[0];
            const stats = {
                total_logins: parseInt(loginStats.total_logins, 10) || 0,
                failed_logins: parseInt(loginStats.failed_logins, 10) || 0,
                active_alerts: parseInt(alertStats.active_alerts, 10) || 0,
                critical_alerts: parseInt(alertStats.critical_alerts, 10) || 0,
                recent_security_events: parseInt(eventsStats.recent_security_events, 10) || 0,
            };
            logger_1.logger.info('Security statistics fetched successfully');
            return stats;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch security statistics', { error });
            throw app_error_1.AppError.internal('Failed to fetch security statistics', error_codes_1.ErrorCode.DATABASE_ERROR);
        }
    }
    /**
     * 获取用户登录历史
     */
    async getUserLoginHistory(user_id, limit = 50) {
        try {
            logger_1.logger.info('Fetching user login history', { user_id, limit });
            const result = await database_1.pool.query(`SELECT id, user_id, username, ip_address, user_agent, success, reason, timestamp
         FROM user_login_history
         WHERE user_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`, [user_id, limit]);
            logger_1.logger.info('User login history fetched successfully', { user_id, count: result.rows.length });
            return result.rows;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch user login history', { user_id, error });
            throw app_error_1.AppError.internal('Failed to fetch user login history', error_codes_1.ErrorCode.DATABASE_ERROR);
        }
    }
    /**
     * 获取未解决的安全警报
     */
    async getUnresolvedAlerts(severity, limit = 100) {
        try {
            logger_1.logger.info('Fetching unresolved security alerts', { severity, limit });
            let query = `SELECT id, event_type, severity, details, user_id, username, ip_address, is_resolved, created_at, resolved_at
                  FROM security_alerts
                  WHERE is_resolved = false`;
            const params = [];
            if (severity) {
                query += ` AND severity = $1`;
                params.push(severity);
                query += ` ORDER BY created_at DESC LIMIT $2`;
                params.push(limit);
            }
            else {
                query += ` ORDER BY created_at DESC LIMIT $1`;
                params.push(limit);
            }
            const result = await database_1.pool.query(query, params);
            // 解析details为对象
            const alerts = result.rows.map((row) => ({
                ...row,
                details: JSON.parse(row.details)
            }));
            logger_1.logger.info('Unresolved security alerts fetched successfully', { count: alerts.length });
            return alerts;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch unresolved security alerts', { severity, error });
            throw app_error_1.AppError.internal('Failed to fetch unresolved security alerts', error_codes_1.ErrorCode.DATABASE_ERROR);
        }
    }
    /**
     * 检测可疑登录行为
     */
    async detectSuspiciousLogins(user_id) {
        try {
            logger_1.logger.info('Detecting suspicious logins', { user_id });
            // 检查短时间内的失败登录尝试
            const failedLoginsResult = await database_1.pool.query(`SELECT COUNT(*) as count
         FROM user_login_history
         WHERE user_id = $1
           AND success = false
           AND timestamp >= NOW() - INTERVAL '1 hour'`, [user_id]);
            const failedLoginCount = parseInt(failedLoginsResult.rows[0].count, 10) || 0;
            // 如果1小时内有5次或更多失败登录，则视为可疑
            const isSuspicious = failedLoginCount >= 5;
            if (isSuspicious) {
                logger_1.logger.warn('Suspicious login pattern detected', { user_id, failedLoginCount });
            }
            return isSuspicious;
        }
        catch (error) {
            logger_1.logger.error('Failed to detect suspicious logins', { user_id, error });
            // 发生错误时返回false，避免误报
            return false;
        }
    }
}
exports.SecurityLogService = SecurityLogService;
// 创建单例实例
exports.securityLogService = new SecurityLogService();
