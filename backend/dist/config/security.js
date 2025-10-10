"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureSecurityMiddleware = configureSecurityMiddleware;
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
function configureSecurityMiddleware(app) {
    // CORS 配置
    const getAllowedOrigins = () => {
        const origins = [];
        // 从环境变量获取允许的域名
        if (process.env.ALLOWED_ORIGINS) {
            origins.push(...process.env.ALLOWED_ORIGINS.split(','));
        }
        // 生产环境默认域名
        if (process.env.NODE_ENV === "production") {
            origins.push("https://yanyu.cloud", "https://admin.yanyu.cloud");
            // 支持 Vercel 部署域名
            origins.push(/\.vercel\.app$/);
        }
        else {
            // 开发环境
            origins.push("http://localhost:3000", "http://localhost:3001");
        }
        // 如果有 FRONTEND_BASE_URL 环境变量，也添加进去
        if (process.env.FRONTEND_BASE_URL) {
            origins.push(process.env.FRONTEND_BASE_URL);
        }
        return origins;
    };
    const corsOptions = {
        origin: (origin, callback) => {
            const allowedOrigins = getAllowedOrigins();
            // 允许没有 origin 的请求（如移动应用、Postman等）
            if (!origin) {
                return callback(null, true);
            }
            // 检查是否在允许列表中
            const isAllowed = allowedOrigins.some(allowed => {
                if (typeof allowed === 'string') {
                    return allowed === origin;
                }
                // RegExp
                return allowed.test(origin);
            });
            if (isAllowed) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
        exposedHeaders: ["X-New-Token"],
        credentials: true,
        maxAge: 86400, // 24小时
    };
    app.use((0, cors_1.default)(corsOptions));
    // Helmet CSP 配置
    const getConnectSrc = () => {
        const sources = ["'self'", "api.yanyu.cloud", "ws.yanyu.cloud"];
        // 在生产环境添加 Vercel 域名支持
        if (process.env.NODE_ENV === "production") {
            sources.push("*.vercel.app", "https://*.vercel.app");
        }
        // 添加环境变量配置的 API URL
        if (process.env.FRONTEND_BASE_URL) {
            sources.push(process.env.FRONTEND_BASE_URL);
        }
        if (process.env.API_BASE_URL) {
            sources.push(process.env.API_BASE_URL);
        }
        return sources;
    };
    app.use(helmet_1.default.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.yanyu.cloud", "*.vercel.app"],
            styleSrc: ["'self'", "'unsafe-inline'", "cdn.yanyu.cloud", "*.vercel.app"],
            imgSrc: ["'self'", "data:", "cdn.yanyu.cloud", "storage.yanyu.cloud", "*.vercel.app"],
            connectSrc: getConnectSrc(),
            fontSrc: ["'self'", "cdn.yanyu.cloud", "*.vercel.app"],
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
