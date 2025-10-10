"use strict";
// 在文件顶部添加dotenv配置以确保环境变量正确加载
const dotenv = require('dotenv');
// 添加调试日志，检查dotenv配置
console.log('Before dotenv.config:', {
    hasDotenv: !!dotenv,
    processEnvKeys: Object.keys(process.env).slice(0, 5) // 只显示前5个环境变量键名
});
dotenv.config();
// 再次检查环境变量
console.log('After dotenv.config:', {
    hasJWTSecret: !!process.env.JWT_SECRET,
    hasJWTRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
    processEnvKeys: Object.keys(process.env).slice(0, 5)
});
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { redis } = require('../config/redis');
const { logger } = require('../config/logger');
const { AppError } = require('../utils/app-error');
const { ErrorCode } = require('../constants/error-codes');
// 从环境变量获取密钥，不提供默认值以确保安全
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10');
// 添加调试日志
console.log('Loaded environment variables:', {
    JWT_SECRET: JWT_SECRET ? 'Present (hidden)' : 'Not found',
    JWT_REFRESH_SECRET: JWT_REFRESH_SECRET ? 'Present (hidden)' : 'Not found',
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY,
    SALT_ROUNDS
});
// 验证必要的环境变量是否存在
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    console.error('Critical error: Missing JWT secrets in environment variables');
    throw new Error('JWT secrets are not configured in environment variables');
}
/**
 * @typedef {Object} TokenPayload
 * @property {string} userId
 * @property {string} email
 * @property {string[]} roles
 */
/**
 * 认证服务类
 */
const AuthService = {
    /**
     * 用户注册
     * @param {string} email - 用户邮箱
     * @param {string} password - 用户密码
     * @param {string} firstName - 用户名字
     * @param {string} lastName - 用户姓氏
     * @returns {Promise<{user: Object, accessToken: string, refreshToken: string}>}
     */
    async register(email, password, firstName, lastName) {
        try {
            // 检查邮箱是否已存在
            const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
            if (existingUser.rows.length > 0) {
                throw AppError.conflict('Email already exists', ErrorCode.CONFLICT);
            }
            // 加密密码
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            // 创建用户
            const userId = crypto.randomUUID();
            const result = await pool.query(`INSERT INTO users (
          id, email, password_hash, first_name, last_name, 
          status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
        RETURNING id, email, first_name, last_name, status, created_at`, [userId, email.toLowerCase(), hashedPassword, firstName, lastName]);
            const user = result.rows[0];
            // 分配默认角色
            await pool.query(`INSERT INTO user_roles (user_id, role_id)
        SELECT $1, id FROM roles WHERE role_name = 'user'`, [userId]);
            // 生成令牌
            const accessToken = this.generateAccessToken({
                userId: user.id,
                email: user.email,
                roles: ['user']
            });
            const refreshToken = this.generateRefreshToken(user.id);
            // 存储刷新令牌
            await this.storeRefreshToken(user.id, refreshToken);
            logger.info('User registered successfully', { userId: user.id, email: user.email });
            return { user, accessToken, refreshToken };
        }
        catch (error) {
            logger.error('Registration failed', { email, error: error.message });
            throw error;
        }
    },
    /**
     * 生成访问令牌
     * @param {TokenPayload} payload
     * @returns {string}
     */
    generateAccessToken(payload) {
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: ACCESS_TOKEN_EXPIRY
        });
    },
    /**
     * 生成刷新令牌
     * @param {string} userId
     * @returns {string}
     */
    generateRefreshToken(userId) {
        return jwt.sign({ userId }, JWT_REFRESH_SECRET, {
            expiresIn: REFRESH_TOKEN_EXPIRY
        });
    },
    /**
     * 验证访问令牌
     * @param {string} token
     * @returns {TokenPayload}
     */
    verifyAccessToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw AppError.unauthorized('Token expired', ErrorCode.TOKEN_EXPIRED);
            }
            else if (error.name === 'JsonWebTokenError') {
                throw AppError.unauthorized('Invalid token', ErrorCode.INVALID_TOKEN);
            }
            throw AppError.unauthorized('Authentication failed', ErrorCode.UNAUTHORIZED);
        }
    },
    /**
     * 验证刷新令牌
     * @param {string} token
     * @returns {Object}
     */
    verifyRefreshToken(token) {
        try {
            return jwt.verify(token, JWT_REFRESH_SECRET);
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw AppError.unauthorized('Refresh token expired', ErrorCode.TOKEN_EXPIRED);
            }
            else if (error.name === 'JsonWebTokenError') {
                throw AppError.unauthorized('Invalid refresh token', ErrorCode.INVALID_TOKEN);
            }
            throw AppError.unauthorized('Authentication failed', ErrorCode.UNAUTHORIZED);
        }
    },
    /**
     * 存储刷新令牌
     * @param {string} userId
     * @param {string} token
     * @returns {Promise<void>}
     */
    async storeRefreshToken(userId, token) {
        const key = `refresh_token:${userId}`;
        await redis.set(key, token, 'EX', 7 * 24 * 60 * 60); // 7天过期
    },
    /**
     * 获取存储的刷新令牌
     * @param {string} userId
     * @returns {Promise<string|null>}
     */
    async getStoredRefreshToken(userId) {
        const key = `refresh_token:${userId}`;
        return await redis.get(key);
    },
    /**
     * 删除刷新令牌
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async deleteRefreshToken(userId) {
        const key = `refresh_token:${userId}`;
        await redis.del(key);
    },
    /**
     * 用户登录
     * @param {string} email
     * @param {string} password
     * @param {string} ipAddress
     * @returns {Promise<{user: Object, accessToken: string, refreshToken: string}>}
     */
    async login(email, password, ipAddress) {
        try {
            // 检查登录尝试次数
            const attemptsKey = `login_attempts:${email}:${ipAddress}`;
            const attempts = await redis.get(attemptsKey);
            if (attempts && parseInt(attempts) >= 5) {
                throw AppError.tooManyRequests('Too many login attempts. Please try again later.', ErrorCode.TOO_MANY_REQUESTS);
            }
            // 查找用户
            const result = await pool.query(`SELECT u.id, u.email, u.password_hash, u.status, 
                ARRAY_AGG(r.role_name) as roles 
         FROM users u 
         LEFT JOIN user_roles ur ON u.id = ur.user_id 
         LEFT JOIN roles r ON ur.role_id = r.id 
         WHERE u.email = $1 
         GROUP BY u.id`, [email.toLowerCase()]);
            if (result.rows.length === 0) {
                await this.recordFailedLogin(email, ipAddress);
                throw AppError.unauthorized('Invalid credentials', ErrorCode.UNAUTHORIZED);
            }
            const user = result.rows[0];
            // 检查用户状态
            if (user.status !== 'active') {
                await this.recordFailedLogin(email, ipAddress);
                throw AppError.unauthorized('Account is not active', ErrorCode.ACCOUNT_INACTIVE);
            }
            // 验证密码
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                await this.recordFailedLogin(email, ipAddress);
                throw AppError.unauthorized('Invalid credentials', ErrorCode.UNAUTHORIZED);
            }
            // 清除登录尝试记录
            await this.clearLoginAttempts(email, ipAddress);
            // 生成令牌
            const accessToken = this.generateAccessToken({
                userId: user.id,
                email: user.email,
                roles: user.roles || []
            });
            const refreshToken = this.generateRefreshToken(user.id);
            // 存储刷新令牌
            await this.storeRefreshToken(user.id, refreshToken);
            // 删除密码哈希，不返回给客户端
            delete user.password_hash;
            logger.info('User logged in successfully', { userId: user.id, email: user.email });
            return { user, accessToken, refreshToken };
        }
        catch (error) {
            logger.warn('Login failed', { email, ipAddress, error: error.message });
            throw error;
        }
    },
    /**
     * 用户登出
     * @param {string} userId
     * @returns {Promise<void>}
     */
    async logout(userId) {
        try {
            await this.deleteRefreshToken(userId);
            logger.info('User logged out successfully', { userId });
        }
        catch (error) {
            logger.error('Logout failed', { userId, error: error.message });
            throw error;
        }
    },
    /**
     * 刷新访问令牌
     * @param {string} refreshToken
     * @returns {Promise<{accessToken: string, refreshToken: string}>}
     */
    async refreshAccessToken(refreshToken) {
        try {
            // 验证刷新令牌
            const decoded = this.verifyRefreshToken(refreshToken);
            const userId = decoded.userId;
            // 检查令牌是否与存储的匹配
            const storedToken = await this.getStoredRefreshToken(userId);
            if (!storedToken || storedToken !== refreshToken) {
                throw AppError.unauthorized('Invalid refresh token', ErrorCode.INVALID_TOKEN);
            }
            // 获取用户信息和角色
            const result = await pool.query(`SELECT u.id, u.email, ARRAY_AGG(r.role_name) as roles 
         FROM users u 
         LEFT JOIN user_roles ur ON u.id = ur.user_id 
         LEFT JOIN roles r ON ur.role_id = r.id 
         WHERE u.id = $1 
         GROUP BY u.id`, [userId]);
            if (result.rows.length === 0) {
                throw AppError.unauthorized('User not found', ErrorCode.USER_NOT_FOUND);
            }
            const user = result.rows[0];
            // 生成新令牌
            const newAccessToken = this.generateAccessToken({
                userId: user.id,
                email: user.email,
                roles: user.roles || []
            });
            const newRefreshToken = this.generateRefreshToken(user.id);
            // 存储新的刷新令牌，替换旧的
            await this.storeRefreshToken(userId, newRefreshToken);
            logger.info('Access token refreshed', { userId });
            return { accessToken: newAccessToken, refreshToken: newRefreshToken };
        }
        catch (error) {
            logger.warn('Token refresh failed', { error: error.message });
            throw error;
        }
    },
    /**
     * 记录失败的登录尝试
     * @param {string} email
     * @param {string} ipAddress
     * @returns {Promise<void>}
     */
    async recordFailedLogin(email, ipAddress) {
        const key = `login_attempts:${email}:${ipAddress}`;
        const attempts = await redis.get(key);
        if (attempts) {
            await redis.incr(key);
        }
        else {
            await redis.set(key, '1', 'EX', 60 * 60); // 1小时后过期
        }
    },
    /**
     * 清除登录尝试记录
     * @param {string} email
     * @param {string} ipAddress
     * @returns {Promise<void>}
     */
    async clearLoginAttempts(email, ipAddress) {
        const key = `login_attempts:${email}:${ipAddress}`;
        await redis.del(key);
    }
};
module.exports = AuthService;
