# Vercel 部署指南

## 概述

本指南介绍如何将 YanYu Cloud³ 前端应用部署到 Vercel 平台。

## 前提条件

- Vercel 账号
- GitHub 仓库访问权限
- 已配置的后端 API 服务

## 部署步骤

### 方式一：通过 Vercel Dashboard（推荐）

1. **登录 Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "New Project"
   - 选择 GitHub 仓库 `YY-Nexus/YYC-AI-management`
   - 点击 "Import"

3. **配置项目**
   - Framework Preset: Next.js
   - Root Directory: `./` (默认)
   - Build Command: `npm run build` (自动检测)
   - Output Directory: `.next` (自动检测)

4. **配置环境变量**

   在 Vercel Dashboard 的 Environment Variables 部分添加以下变量：

   **必需的环境变量：**
   ```bash
   # API 配置
   NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com
   NEXT_PUBLIC_ENV=production
   NEXT_PUBLIC_WS_URL=wss://your-api-domain.com
   
   # 品牌配置
   NEXT_PUBLIC_BRAND_NAME=YanYu Cloud³
   NEXT_PUBLIC_VERSION=v1.0.0
   NEXT_PUBLIC_APP_TITLE=智能业务管理平台
   NEXT_PUBLIC_SUPPORT_EMAIL=support@yanyu.cloud
   ```

   **可选的环境变量：**
   ```bash
   # 监控和分析
   NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
   NEXT_PUBLIC_GA_TRACKING_ID=your-ga-id
   ```

5. **部署**
   - 点击 "Deploy"
   - 等待构建完成（通常 2-5 分钟）

### 方式二：通过 Vercel CLI

1. **安装 Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署到生产环境**
   ```bash
   vercel --prod
   ```

4. **设置环境变量**
   ```bash
   # 添加环境变量
   vercel env add NEXT_PUBLIC_API_BASE_URL production
   
   # 从文件导入
   vercel env pull .env.production.local
   ```

## 后端 API CORS 配置

确保后端 API 允许来自 Vercel 域名的请求：

### 环境变量配置

在后端服务器设置以下环境变量：

```bash
# 允许的前端域名（包括 Vercel 部署域名）
ALLOWED_ORIGINS=https://your-app.vercel.app,https://yanyu.cloud
FRONTEND_BASE_URL=https://your-app.vercel.app
```

### 自动支持

本项目已配置自动支持 Vercel 域名：

- 生产环境下，后端会自动允许 `*.vercel.app` 域名
- CSP 策略已包含 Vercel 域名
- CORS 配置支持动态域名验证

## 域名配置

### 使用自定义域名

1. **在 Vercel 中添加域名**
   - 进入项目 Settings > Domains
   - 添加你的自定义域名（如 `app.yanyu.cloud`）

2. **配置 DNS**
   - 添加 CNAME 记录指向 Vercel
   - 或使用 A 记录指向 Vercel IP

3. **更新后端 CORS**
   - 将自定义域名添加到 `ALLOWED_ORIGINS`
   ```bash
   ALLOWED_ORIGINS=https://app.yanyu.cloud,https://yanyu.cloud
   ```

## 环境变量管理

### 环境区分

Vercel 支持三种环境：

- **Production**: 主分支部署
- **Preview**: Pull Request 预览
- **Development**: 本地开发

### 设置不同环境的变量

```bash
# 生产环境
vercel env add NEXT_PUBLIC_API_BASE_URL production

# 预览环境
vercel env add NEXT_PUBLIC_API_BASE_URL preview

# 开发环境
vercel env add NEXT_PUBLIC_API_BASE_URL development
```

### 敏感信息管理

使用 Vercel Secrets 管理敏感信息：

```bash
# 创建 secret
vercel secrets add api-base-url https://api.yanyu.cloud

# 在环境变量中引用
# 在 vercel.json 中使用 @api-base-url
```

## 构建优化

### 提高构建速度

在 `vercel.json` 中配置：

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "framework": "nextjs",
  "regions": ["hkg1"]
}
```

### 缓存优化

Vercel 自动缓存：
- Node modules
- Next.js 构建输出
- 静态资源

## 监控和日志

### 查看部署日志

1. **Dashboard 查看**
   - 进入项目 > Deployments
   - 点击具体部署查看日志

2. **CLI 查看**
   ```bash
   vercel logs
   ```

### 运行时日志

```bash
# 实时日志
vercel logs --follow

# 查看特定部署的日志
vercel logs [deployment-url]
```

## 常见问题

### 1. CORS 错误

**问题**: 前端无法连接后端 API

**解决方案**:
```bash
# 确保后端配置了正确的 ALLOWED_ORIGINS
ALLOWED_ORIGINS=https://your-app.vercel.app

# 或在后端代码中已支持 *.vercel.app
```

### 2. 环境变量未生效

**问题**: 环境变量在构建时未被使用

**解决方案**:
- 确保变量以 `NEXT_PUBLIC_` 开头（如需在客户端使用）
- 重新部署以应用新的环境变量
- 检查 Vercel Dashboard 中的环境变量设置

### 3. 构建失败

**问题**: 构建过程中出错

**解决方案**:
```bash
# 本地测试构建
npm run build

# 检查 package.json 中的依赖
npm ci

# 清除缓存重新部署
vercel --force
```

### 4. 404 错误

**问题**: 某些路由返回 404

**解决方案**:
- 检查 `vercel.json` 中的 rewrites 配置
- 确保 Next.js 路由配置正确
- 查看 Vercel 函数日志

### 5. 性能问题

**问题**: 页面加载缓慢

**解决方案**:
- 检查图片优化配置
- 启用静态生成（SSG）
- 配置 CDN 和缓存策略
- 选择最近的 Vercel 区域（香港: hkg1）

## 安全配置

### CSP 策略

已在 `next.config.mjs` 中配置：

```javascript
headers: [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; ..."
  }
]
```

### 安全头部

自动包含：
- `Strict-Transport-Security`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`

## 回滚部署

### 通过 Dashboard

1. 进入 Deployments
2. 选择之前的成功部署
3. 点击 "Promote to Production"

### 通过 CLI

```bash
# 列出部署历史
vercel ls

# 回滚到指定版本
vercel promote [deployment-url]
```

## CI/CD 集成

Vercel 自动集成 GitHub：

- **自动部署**: Push 到主分支自动部署到生产环境
- **预览部署**: Pull Request 自动创建预览部署
- **状态检查**: 在 GitHub PR 中显示部署状态

### GitHub Actions 集成

如需自定义 CI/CD 流程，参考 `.github/workflows/ci-cd.yml`

## 性能优化

### 区域配置

选择离用户最近的区域：

```json
{
  "regions": ["hkg1"]  // 香港
}
```

### 缓存策略

```json
{
  "headers": [
    {
      "source": "/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## 团队协作

### 添加团队成员

1. 进入项目 Settings > Members
2. 邀请团队成员
3. 分配权限（Owner/Member/Viewer）

### 部署保护

配置部署保护规则：
- 需要审批才能部署到生产环境
- 限制谁可以部署
- 设置部署时间窗口

## 支持资源

- [Vercel 官方文档](https://vercel.com/docs)
- [Next.js 部署指南](https://nextjs.org/docs/deployment)
- [项目问题追踪](https://github.com/YY-Nexus/YYC-AI-management/issues)

## 联系支持

如遇到问题：
- GitHub Issues: [项目 Issues](https://github.com/YY-Nexus/YYC-AI-management/issues)
- Email: support@yanyu.cloud
