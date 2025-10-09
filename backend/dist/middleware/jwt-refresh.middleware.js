"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtRefreshMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../config/logger");
const jwtRefreshMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return next();
        }
        const token = authHeader.substring(7);
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // 如果token剩余有效期不足15分钟则刷新
        const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
        if (expiresIn < 900) {
            const newToken = jsonwebtoken_1.default.sign({ userId: decoded.userId }, process.env.JWT_SECRET, { expiresIn: "2h" });
            // 在响应头中返回新令牌
            res.setHeader("X-New-Token", newToken);
            logger_1.logger.info(`Refreshed JWT token for user: ${decoded.userId}`);
        }
        next();
    }
    catch (error) {
        // 令牌验证错误不中断请求，让后续中间件处理身份验证
        next();
    }
};
exports.jwtRefreshMiddleware = jwtRefreshMiddleware;
