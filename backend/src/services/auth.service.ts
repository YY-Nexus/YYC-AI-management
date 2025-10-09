import { ErrorCode } from '../constants/error-codes';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { pool } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { AppError } from '../utils/app-error';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const SALT_ROUNDS = 10;

interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

export class AuthService {
  // 用户注册
  static async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    try {
      // 检查邮箱是否已存在
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw AppError.conflict('Email already exists', ErrorCode.CONFLICT);
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // 创建用户
      const userId = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO users (
          id, email, password_hash, first_name, last_name, 
          status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
        RETURNING id, email, first_name, last_name, status, created_at`,
        [userId, email.toLowerCase(), hashedPassword, firstName, lastName]
      );

      const user = result.rows[0];

      // 分配默认角色
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id)
        SELECT $1, id FROM roles WHERE role_name = 'user'`,
        [userId]
      );

      // 生成令牌
      const accessToken = this.generateAccessToken({
        userId: user.id,
        email: user.email,
        roles: ['user'],
      });

      const refreshToken = this.generateRefreshToken({
        userId: user.id,
        email: user.email,
        roles: ['user'],
      });

      // 存储刷新令牌
      await this.storeRefreshToken(userId, refreshToken);

      logger.info('User registered successfully', { userId, email });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          status: user.status,
          createdAt: user.created_at,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Registration failed', { error, email });
      throw error;
    }
  }

  // 用户登录
  static async login(
    email: string,
    password: string,
    ipAddress: string
  ): Promise<{ user: any; accessToken: string; refreshToken: string }> {
    try {
      // 检查登录失败次数
      await this.checkLoginAttempts(email, ipAddress);

      // 查找用户
      const result = await pool.query(
        `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, 
                u.status, u.locked_at, ARRAY_AGG(r.role_name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.email = $1
        GROUP BY u.id`,
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        await this.recordFailedLogin(email, ipAddress);
        throw AppError.unauthorized('Invalid credentials', ErrorCode.UNAUTHORIZED);
      }

      const user = result.rows[0];

      // 检查账户状态
      if (user.status === 'locked') {
        throw AppError.forbidden('Account is locked', ErrorCode.FORBIDDEN);
      }

      if (user.status === 'inactive') {
        throw AppError.forbidden('Account is inactive', ErrorCode.FORBIDDEN);
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        await this.recordFailedLogin(email, ipAddress);
        throw AppError.unauthorized('Invalid credentials', ErrorCode.UNAUTHORIZED);
      }

      // 清除失败记录
      await this.clearLoginAttempts(email, ipAddress);

      // 生成令牌
      const accessToken = this.generateAccessToken({
        userId: user.id,
        email: user.email,
        roles: user.roles || ['user'],
      });

      const refreshToken = this.generateRefreshToken({
        userId: user.id,
        email: user.email,
        roles: user.roles || ['user'],
      });

      // 存储刷新令牌
      await this.storeRefreshToken(user.id, refreshToken);

      // 更新最后登录时间
      await pool.query(
        `UPDATE users 
        SET last_login_at = NOW(), last_login_ip = $1, login_count = login_count + 1
        WHERE id = $2`,
        [ipAddress, user.id]
      );

      // 记录登录历史
      await pool.query(
        `INSERT INTO user_login_history (user_id, ip_address)
        VALUES ($1, $2)`,
        [user.id, ipAddress]
      );

      logger.info('User logged in successfully', { userId: user.id, email });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          status: user.status,
          roles: user.roles,
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      logger.error('Login failed', { error, email });
      throw error;
    }
  }

  // 刷新令牌
  static async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // 验证刷新令牌
      const payload = this.verifyRefreshToken(refreshToken);

      // 检查令牌是否有效（未被撤销）
      const storedToken = await redis.get(`refresh_token:${payload.userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw AppError.unauthorized('Invalid refresh token', ErrorCode.INVALID_TOKEN);
      }

      // 获取用户角色
      const roleResult = await pool.query(
        `SELECT ARRAY_AGG(r.role_name) as roles
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1`,
        [payload.userId]
      );

      const roles = roleResult.rows[0]?.roles || ['user'];

      // 生成新的令牌
      const newAccessToken = this.generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        roles,
      });

      const newRefreshToken = this.generateRefreshToken({
        userId: payload.userId,
        email: payload.email,
        roles,
      });

      // 存储新的刷新令牌
      await this.storeRefreshToken(payload.userId, newRefreshToken);

      logger.info('Token refreshed successfully', { userId: payload.userId });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      logger.error('Token refresh failed', { error });
      throw error;
    }
  }

  // 登出
  static async logout(userId: string, refreshToken?: string): Promise<void> {
    try {
      // 撤销特定令牌或所有令牌
      if (refreshToken) {
        // 验证令牌是否属于该用户
        const payload = this.verifyRefreshToken(refreshToken);
        if (payload.userId !== userId) {
          throw AppError.unauthorized('Invalid refresh token', ErrorCode.INVALID_TOKEN);
        }
        // 删除特定令牌
        await redis.del(`refresh_token:${userId}`);
      } else {
        // 删除所有令牌（强制登出所有设备）
        await redis.del(`refresh_token:${userId}`);
      }

      logger.info('User logged out', { userId });
    } catch (error) {
      logger.error('Logout failed', { error, userId });
      throw error;
    }
  }

  // 请求密码重置
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      // 查找用户
      const result = await pool.query(
        'SELECT id, email FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        // 不透露用户是否存在
        logger.info('Password reset requested for non-existent email', { email });
        return;
      }

      const user = result.rows[0];

      // 生成重置令牌
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = await bcrypt.hash(resetToken, 10);
      const expiresAt = new Date(Date.now() + 3600000); // 1小时后过期

      // 存储重置令牌
      await pool.query(
        `INSERT INTO password_resets (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE
        SET token = $2, expires_at = $3, updated_at = NOW()`,
        [user.id, hashedToken, expiresAt]
      );

      // 这里应该发送邮件，但省略了实际的邮件发送逻辑
      logger.info('Password reset token created', { userId: user.id, email });
    } catch (error) {
      logger.error('Password reset request failed', { error, email });
      throw error;
    }
  }

  // 重置密码
  static async resetPassword(token: string, password: string): Promise<void> {
    try {
      // 查找有效的重置令牌
      const result = await pool.query(
        `SELECT pr.user_id, pr.token, pr.expires_at, u.email
        FROM password_resets pr
        JOIN users u ON pr.user_id = u.id
        WHERE pr.expires_at > NOW()
        ORDER BY pr.created_at DESC
        LIMIT 1`
      );

      if (result.rows.length === 0) {
        throw AppError.badRequest('Invalid or expired reset token', ErrorCode.VALIDATION_ERROR);
      }

      const { user_id: userId, token: hashedToken, email } = result.rows[0];

      // 验证令牌
      const isValid = await bcrypt.compare(token, hashedToken);
      if (!isValid) {
        throw AppError.badRequest('Invalid reset token', ErrorCode.VALIDATION_ERROR);
      }

      // 加密新密码
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // 开始事务
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 更新密码
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
          [passwordHash, userId]
        );

        // 删除重置令牌
        await client.query(
          'DELETE FROM password_resets WHERE user_id = $1',
          [userId]
        );

        // 撤销所有会话
        await redis.del(`refresh_token:${userId}`);

        await client.query('COMMIT');

        logger.info('Password reset successfully', { userId, email });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Password reset failed', { error });
      throw error;
    }
  }

  // 修改密码
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // 获取当前密码哈希
      const result = await pool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw AppError.notFound('User not found', ErrorCode.NOT_FOUND);
      }

      const currentHash = result.rows[0].password_hash;

      // 验证当前密码
      const isValid = await bcrypt.compare(currentPassword, currentHash);

      if (!isValid) {
        throw AppError.unauthorized('Current password is incorrect', ErrorCode.UNAUTHORIZED);
      }

      // 加密新密码
      const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // 更新密码
      await pool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newHash, userId]
      );

      // 撤销所有现有会话（可选）
      await redis.del(`refresh_token:${userId}`);

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Password change failed', { error, userId });
      throw error;
    }
  }

  // 生成访问令牌
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  }

  // 生成刷新令牌
  static generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });
  }

  // 验证访问令牌
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      throw AppError.unauthorized('Invalid or expired access token', ErrorCode.INVALID_TOKEN);
    }
  }

  // 验证刷新令牌
  static verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
    } catch (error) {
      throw AppError.unauthorized('Invalid or expired refresh token', ErrorCode.INVALID_TOKEN);
    }
  }

  // 存储刷新令牌
  static async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    // 存储令牌，设置过期时间（与令牌过期时间匹配）
    await redis.set(`refresh_token:${userId}`, refreshToken, 'EX', 7 * 24 * 60 * 60);
  }

  // 检查登录尝试次数
  static async checkLoginAttempts(email: string, ipAddress: string): Promise<void> {
    const key = `login_attempts:${email}:${ipAddress}`;
    const attempts = await redis.get(key);

    if (attempts && parseInt(attempts) >= 5) {
      // 检查是否超过5次失败尝试
      const lockKey = `login_lock:${email}:${ipAddress}`;
      const lock = await redis.get(lockKey);

      if (!lock) {
        // 设置15分钟锁定
        await redis.set(lockKey, 'locked', 'EX', 15 * 60);
      }

      throw AppError.badRequest('Too many login attempts. Please try again later.', ErrorCode.BUSINESS_ERROR);
    }
  }

  // 记录失败的登录尝试
  static async recordFailedLogin(email: string, ipAddress: string): Promise<void> {
    const key = `login_attempts:${email}:${ipAddress}`;
    const attempts = await redis.get(key);

    if (attempts) {
      await redis.incr(key);
    } else {
      await redis.set(key, '1', 'EX', 60 * 60); // 1小时后过期
    }
  }

  // 清除登录尝试记录
  static async clearLoginAttempts(email: string, ipAddress: string): Promise<void> {
    const key = `login_attempts:${email}:${ipAddress}`;
    await redis.del(key);
  }
}