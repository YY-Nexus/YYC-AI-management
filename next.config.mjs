/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    domains: ['storage.yanyu.cloud'],
    minimumCacheTTL: 3600,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    path: '/_next/image',
    loader: 'default',
  },
  // 启用构建压缩
  swcMinify: true,
  // 优化字体加载
  optimizeFonts: true,
  // 开启构建缓存
  experimental: {
    turbotrace: {
      logLevel: 'error',
    },
  },
  // CDN 配置
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? 'https://cdn.yanyu.cloud' 
    : undefined,
  webpack: (config, { dev, isServer }) => {
    // 启用代码分割优化
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 100000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        automaticNameDelimiter: '~',
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          // 将大型第三方库单独打包
          framework: {
            name: 'framework',
            test: /node_modules[/\\](react|react-dom|next|@next)/,
            priority: 40,
            // 此 chunk 会被 vendor 和 app 共用
            enforce: true,
          },
          ui: {
            name: 'ui-components',
            test: /components[\\/]ui/,
            priority: 30,
            enforce: true,
          },
        },
      };
    }
    return config;
  },
};* @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
