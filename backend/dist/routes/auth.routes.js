"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_service_1 = require("../services/auth.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const logger_1 = require("../config/logger");
const app_error_1 = require("../utils/app-error");
const error_codes_1 = require("../constants/error-codes");
const router = (0, express_1.Router)();
/**
 * @route POST /api/auth/register
 * @desc 用户注册
 * @access Public
 */
router.post('/register', [
    (0, express_validator_1.body)('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    (0, express_validator_1.body)('firstName')
        .isString()
        .isLength({ min: 2 })
        .withMessage('First name must be at least 2 characters'),
    (0, express_validator_1.body)('lastName')
        .isString()
        .isLength({ min: 2 })
        .withMessage('Last name must be at least 2 characters'),
], async (req, res, next) => {
    try {
        // 验证输入
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw app_error_1.AppError.badRequest('Validation failed', error_codes_1.ErrorCode.VALIDATION_ERROR, errors.array());
        }
        const { email, password, firstName, lastName } = req.body;
        // 创建用户
        const result = await auth_service_1.AuthService.register(email, password, firstName, lastName);
        logger_1.logger.info('User registered successfully', { email });
        res.status(201).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/auth/login
 * @desc 用户登录
 * @access Public
 */
router.post('/login', [
    (0, express_validator_1.body)('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
], async (req, res, next) => {
    try {
        // 验证输入
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw app_error_1.AppError.badRequest('Validation failed', error_codes_1.ErrorCode.VALIDATION_ERROR, errors.array());
        }
        const { email, password } = req.body;
        // 获取客户端IP
        const ipAddress = req.ip || req.connection.remoteAddress || '';
        // 登录用户
        const result = await auth_service_1.AuthService.login(email, password, ipAddress);
        logger_1.logger.info('User logged in successfully', { email });
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/auth/refresh
 * @desc 刷新访问令牌
 * @access Public (需要有效刷新令牌)
 */
router.post('/refresh', [
    (0, express_validator_1.body)('refreshToken').notEmpty().withMessage('Refresh token is required'),
], async (req, res, next) => {
    try {
        // 验证输入
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw app_error_1.AppError.badRequest('Validation failed', error_codes_1.ErrorCode.VALIDATION_ERROR, errors.array());
        }
        const { refreshToken } = req.body;
        // 刷新令牌
        const result = await auth_service_1.AuthService.refreshToken(refreshToken);
        logger_1.logger.info('Token refreshed successfully');
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/auth/logout
 * @desc 用户登出
 * @access Private
 */
router.post('/logout', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        const { refreshToken } = req.body;
        if (!userId) {
            throw app_error_1.AppError.unauthorized('User not authenticated', error_codes_1.ErrorCode.UNAUTHORIZED);
        }
        // 登出用户
        await auth_service_1.AuthService.logout(userId, refreshToken);
        logger_1.logger.info('User logged out successfully', { userId });
        res.status(200).json({
            success: true,
            message: 'Successfully logged out',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/auth/password-reset/request
 * @desc 请求密码重置
 * @access Public
 */
router.post('/password-reset/request', [
    (0, express_validator_1.body)('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
], async (req, res, next) => {
    try {
        // 验证输入
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw app_error_1.AppError.badRequest('Validation failed', error_codes_1.ErrorCode.VALIDATION_ERROR, errors.array());
        }
        const { email } = req.body;
        // 请求密码重置
        await auth_service_1.AuthService.requestPasswordReset(email);
        logger_1.logger.info('Password reset request processed', { email });
        // 注意：不透露用户是否存在
        res.status(200).json({
            success: true,
            message: 'If the email exists, a password reset link has been sent',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/auth/password-reset/reset
 * @desc 重置密码
 * @access Public (需要有效重置令牌)
 */
router.post('/password-reset/reset', [
    (0, express_validator_1.body)('token').notEmpty().withMessage('Reset token is required'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    (0, express_validator_1.body)('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    }),
], async (req, res, next) => {
    try {
        // 验证输入
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw app_error_1.AppError.badRequest('Validation failed', error_codes_1.ErrorCode.VALIDATION_ERROR, errors.array());
        }
        const { token, password } = req.body;
        // 重置密码
        await auth_service_1.AuthService.resetPassword(token, password);
        logger_1.logger.info('Password reset successfully');
        res.status(200).json({
            success: true,
            message: 'Password has been reset successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route POST /api/auth/password/change
 * @desc 修改密码
 * @access Private
 */
router.post('/password/change', auth_middleware_1.authenticate, [
    (0, express_validator_1.body)('currentPassword').notEmpty().withMessage('Current password is required'),
    (0, express_validator_1.body)('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
], async (req, res, next) => {
    try {
        // 验证输入
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            throw app_error_1.AppError.badRequest('Validation failed', error_codes_1.ErrorCode.VALIDATION_ERROR, errors.array());
        }
        const userId = req.user?.userId;
        const { currentPassword, newPassword } = req.body;
        if (!userId) {
            throw app_error_1.AppError.unauthorized('User not authenticated', error_codes_1.ErrorCode.UNAUTHORIZED);
        }
        // 修改密码
        await auth_service_1.AuthService.changePassword(userId, currentPassword, newPassword);
        logger_1.logger.info('Password changed successfully', { userId });
        res.status(200).json({
            success: true,
            message: 'Password has been changed successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/auth/me
 * @desc 获取当前用户信息
 * @access Private
 */
router.get('/me', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            throw app_error_1.AppError.unauthorized('User not authenticated', error_codes_1.ErrorCode.UNAUTHORIZED);
        }
        logger_1.logger.info('Retrieved current user info', { userId: user.userId });
        res.status(200).json({
            success: true,
            data: user,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route GET /api/auth/permissions
 * @desc 获取当前用户权限
 * @access Private
 */
router.get('/permissions', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            throw app_error_1.AppError.unauthorized('User not authenticated', error_codes_1.ErrorCode.UNAUTHORIZED);
        }
        logger_1.logger.info('Retrieved user permissions', { userId: user.userId });
        res.status(200).json({
            success: true,
            data: {
                roles: user.roles,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
