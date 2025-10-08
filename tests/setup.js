// 测试环境全局设置 - JavaScript版本
console.log("🧪 设置测试环境...");

// 配置环境变量
process.env.NODE_ENV = "test";
process.env.DB_HOST = "localhost";
process.env.DB_PORT = "5432";
process.env.DB_NAME = "test_db";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "6379";
process.env.JWT_SECRET = "test-jwt-secret";

// 设置jest超时
jest.setTimeout(30000);

// 全局beforeEach清理
beforeEach(() => {
  jest.clearAllMocks();
});

console.log("✅ 测试环境设置完成");
