"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRole = exports.isAuthenticated = exports.getCurrentUser = exports.sessionTimeout = exports.csrfProtection = exports.optionalAuth = exports.authorize = exports.authenticate = void 0;
const auth_service_1 = require("../services/auth.service");
const app_error_1 = require("../utils/app-error");
const logger_1 = require("../config/logger");
const error_codes_1 = require("../constants/error-codes");
/**
 * 认证中间件 - 验证访问令牌
 */
const authenticate = async (req, res, next) => {
    try {
        // 从请求头中获取令牌
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            throw app_error_1.AppError.unauthorized('Authorization header is required', error_codes_1.ErrorCode.UNAUTHORIZED);
        }
        const [bearer, token] = authHeader.split(' ');
        if (bearer !== 'Bearer' || !token) {
            throw app_error_1.AppError.unauthorized('Invalid authorization format. Use Bearer token', error_codes_1.ErrorCode.UNAUTHORIZED);
        }
        // 验证令牌并获取用户信息
        const user = auth_service_1.AuthService.verifyAccessToken(token);
        req.user = user;
        // 记录认证事件
        logger_1.logger.info('User authenticated', { userId: user.userId, email: user.email });
        // 继续请求处理
        next();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.warn('Authentication failed', { error: errorMessage });
        next(error);
    }
};
exports.authenticate = authenticate;
/**
 * 授权中间件 - 验证用户角色
 */
const authorize = (roles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw app_error_1.AppError.unauthorized('User not authenticated', error_codes_1.ErrorCode.UNAUTHORIZED);
            }
            // 检查用户是否有任何所需角色
            const hasRole = req.user.roles.some(userRole => roles.includes(userRole));
            if (!hasRole) {
                throw app_error_1.AppError.forbidden('Insufficient permissions', error_codes_1.ErrorCode.FORBIDDEN);
            }
            logger_1.logger.info('User authorized', {
                userId: req.user.userId,
                email: req.user.email,
                requiredRoles: roles,
                userRoles: req.user.roles
            });
            next();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.logger.warn('Authorization failed', { error: errorMessage });
            next(error);
        }
    };
};
exports.authorize = authorize;
/**
 * 可选认证中间件 - 有令牌则认证，无令牌也可以继续
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const [bearer, token] = authHeader.split(' ');
            if (bearer === 'Bearer' && token) {
                try {
                    const user = auth_service_1.AuthService.verifyAccessToken(token);
                    req.user = user;
                    logger_1.logger.info('Optional authentication successful', { userId: user.userId });
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    // 可选认证情况下，令牌验证失败不阻止请求
                    logger_1.logger.warn('Optional authentication token invalid', { error: errorMessage });
                }
            }
        }
        next();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.warn('Optional authentication middleware error', { error: errorMessage });
        next(); // 即使中间件本身出错，也继续请求处理
    }
};
exports.optionalAuth = optionalAuth;
/**
 * CSRF保护中间件
 */
const csrfProtection = (req, res, next) => {
    // 对于API请求，通常只需要验证来源头
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    // 检查是否是安全的请求方法
    const isSafeMethod = ['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(req.method);
    // 对于不安全的方法，验证来源
    if (!isSafeMethod && origin && !allowedOrigins.includes(origin)) {
        logger_1.logger.warn('CSRF protection rejected request', { origin, method: req.method });
        return next(app_error_1.AppError.forbidden('Invalid CSRF token', error_codes_1.ErrorCode.FORBIDDEN));
    }
    next();
};
exports.csrfProtection = csrfProtection;
/**
 * 会话超时检查中间件
 */
const sessionTimeout = (timeoutMinutes = 30) => {
    const timeoutMs = timeoutMinutes * 60 * 1000;
    return (req, res, next) => {
        if (req.user) {
            // 这里简化处理，实际项目中可能需要在Redis中存储用户的最后活动时间
            // 然后检查是否超过了超时时间
            next();
        }
        else {
            next();
        }
    };
};
exports.sessionTimeout = sessionTimeout;
/**
 * 获取当前用户信息辅助函数
 */
const getCurrentUser = (req) => {
    return req.user;
};
exports.getCurrentUser = getCurrentUser;
/**
 * 检查用户是否已认证
 */
const isAuthenticated = (req) => {
    return !!req.user;
};
exports.isAuthenticated = isAuthenticated;
/**
 * 检查用户是否具有特定角色
 */
const hasRole = (req, role) => {
    return req.user?.roles.includes(role) || false;
};
exports.hasRole = hasRole;
