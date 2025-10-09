import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AppError } from '../utils/app-error';
import { logger } from '../config/logger';
import { ErrorCode } from '../constants/error-codes';

interface UserPayload {
  userId: string;
  email: string;
  roles: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

/**
 * 认证中间件 - 验证访问令牌
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 从请求头中获取令牌
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw AppError.unauthorized('Authorization header is required', ErrorCode.UNAUTHORIZED);
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      throw AppError.unauthorized('Invalid authorization format. Use Bearer token', ErrorCode.UNAUTHORIZED);
    }

    // 验证令牌并获取用户信息
    const user = AuthService.verifyAccessToken(token);
    req.user = user;

    // 记录认证事件
    logger.info('User authenticated', { userId: user.userId, email: user.email });

    // 继续请求处理
    next();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Authentication failed', { error: errorMessage });
    next(error as Error);
  }
};

/**
 * 授权中间件 - 验证用户角色
 */
export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('User not authenticated', ErrorCode.UNAUTHORIZED);
      }

      // 检查用户是否有任何所需角色
      const hasRole = req.user.roles.some(userRole => 
        roles.includes(userRole)
      );

      if (!hasRole) {
        throw AppError.forbidden('Insufficient permissions', ErrorCode.FORBIDDEN);
      }

      logger.info('User authorized', {
        userId: req.user.userId,
        email: req.user.email,
        requiredRoles: roles,
        userRoles: req.user.roles
      });

      next();
    } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Authorization failed', { error: errorMessage });
    next(error as Error);
  }
  };
};

/**
 * 可选认证中间件 - 有令牌则认证，无令牌也可以继续
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const [bearer, token] = authHeader.split(' ');
      if (bearer === 'Bearer' && token) {
        try {
          const user = AuthService.verifyAccessToken(token);
          req.user = user;
          logger.info('Optional authentication successful', { userId: user.userId });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // 可选认证情况下，令牌验证失败不阻止请求
            logger.warn('Optional authentication token invalid', { error: errorMessage });
        }
      }
    }
    next();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Optional authentication middleware error', { error: errorMessage });
    next(); // 即使中间件本身出错，也继续请求处理
  }
};

/**
 * CSRF保护中间件
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // 对于API请求，通常只需要验证来源头
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];

  // 检查是否是安全的请求方法
  const isSafeMethod = ['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(req.method);

  // 对于不安全的方法，验证来源
  if (!isSafeMethod && origin && !allowedOrigins.includes(origin)) {
    logger.warn('CSRF protection rejected request', { origin, method: req.method });
    return next(AppError.forbidden('Invalid CSRF token', ErrorCode.FORBIDDEN));
  }

  next();
};

/**
 * 会话超时检查中间件
 */
export const sessionTimeout = (timeoutMinutes = 30) => {
  const timeoutMs = timeoutMinutes * 60 * 1000;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user) {
      // 这里简化处理，实际项目中可能需要在Redis中存储用户的最后活动时间
      // 然后检查是否超过了超时时间
      next();
    } else {
      next();
    }
  };
};

/**
 * 获取当前用户信息辅助函数
 */
export const getCurrentUser = (req: Request): UserPayload | undefined => {
  return req.user;
};

/**
 * 检查用户是否已认证
 */
export const isAuthenticated = (req: Request): boolean => {
  return !!req.user;
};

/**
 * 检查用户是否具有特定角色
 */
export const hasRole = (req: Request, role: string): boolean => {
  return req.user?.roles.includes(role) || false;
};
