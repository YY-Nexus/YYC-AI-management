"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRateLimit = exports.apiRateLimit = exports.authRateLimit = exports.generalRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// 通用速率限制
exports.generalRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP最多100个请求
    message: {
        error: "Too many requests from this IP, please try again after 15 minutes.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// 登录接口的严格速率限制
exports.authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5, // 每个IP最多5次登录尝试
    message: {
        error: "Too many login attempts from this IP, please try again after 15 minutes.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// API接口速率限制
exports.apiRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 30, // 每个IP每分钟最多30个API请求
    message: {
        error: "API rate limit exceeded, please slow down your requests.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// 文件上传速率限制
exports.uploadRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 10, // 每个IP每小时最多10次上传
    message: {
        error: "Upload rate limit exceeded, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
