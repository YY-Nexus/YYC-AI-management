"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureSecurityMiddleware = configureSecurityMiddleware;
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
function configureSecurityMiddleware(app) {
    // CORS 配置
    const corsOptions = {
        origin: process.env.NODE_ENV === "production"
            ? ["https://yanyu.cloud", "https://admin.yanyu.cloud"]
            : ["http://localhost:3000", "http://localhost:3001"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        exposedHeaders: ["X-New-Token"],
        credentials: true,
        maxAge: 86400, // 24小时
    };
    app.use((0, cors_1.default)(corsOptions));
    // Helmet CSP 配置
    app.use(helmet_1.default.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.yanyu.cloud"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdn.yanyu.cloud"],
            imgSrc: ["'self'", "data:", "cdn.yanyu.cloud", "storage.yanyu.cloud"],
            connectSrc: ["'self'", "api.yanyu.cloud", "ws.yanyu.cloud"],
            fontSrc: ["'self'", "cdn.yanyu.cloud"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    }));
    // 其他安全标头
    app.use(helmet_1.default.xssFilter());
    app.use(helmet_1.default.noSniff());
    app.use(helmet_1.default.hidePoweredBy());
    app.use(helmet_1.default.frameguard({ action: "deny" }));
    app.use(helmet_1.default.referrerPolicy({ policy: "same-origin" }));
}
