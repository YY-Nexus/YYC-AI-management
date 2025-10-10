"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAnalyticsRead = exports.requireReconciliationWrite = exports.requireReconciliationRead = exports.requireAdmin = void 0;
exports.requirePermission = requirePermission;
const permission_service_1 = require("../services/permission.service");
const logger_1 = require("../config/logger");
function requirePermission(action, resource) {
    return async (req, res, next) => {
        try {
            // 检查用户是否已认证
            if (!req.user || !req.user.userId) {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: "ERR_1001",
                        message: "Authentication required",
                    },
                });
            }
            const userId = req.user.userId;
            const resourceId = req.params.id; // 可选的资源ID
            // 检查权限
            const hasPermission = await permission_service_1.PermissionService.checkPermission(userId, action, resource, resourceId);
            if (!hasPermission) {
                logger_1.logger.warn("Permission denied", {
                    userId,
                    action,
                    resource,
                    resourceId,
                    path: req.path,
                    method: req.method,
                });
                return res.status(403).json({
                    success: false,
                    error: {
                        code: "ERR_1005",
                        message: "Insufficient permissions",
                    },
                });
            }
            next();
        }
        catch (error) {
            logger_1.logger.error("Permission check error", { error, userId: req.user?.userId });
            return res.status(500).json({
                success: false,
                error: {
                    code: "ERR_5001",
                    message: "Internal server error",
                },
            });
        }
    };
}
// 预定义的权限检查器
exports.requireAdmin = requirePermission("*", "*");
exports.requireReconciliationRead = requirePermission("read", "reconciliation");
exports.requireReconciliationWrite = requirePermission("write", "reconciliation");
exports.requireAnalyticsRead = requirePermission("read", "analytics");
