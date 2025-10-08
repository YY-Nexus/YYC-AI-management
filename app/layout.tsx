import '../styles/globals.css'; // ✅ 引入全局样式
import type React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '../theme-provider'; // ✅ 根目录引入

export const metadata: Metadata = {
  title: 'YanYu Cloud³ Cube · 智能云枢管理平台',
  description: '万象归元于云枢，深栈智启新纪元 —— YanYu Cloud³ AI Family，打造企业级智能管理新范式。',
  keywords: 'YanYu Cloud³, YYC Cube, 云管理平台, 企业智能, AI系统, 智能云枢, 数字化转型',
  authors: [{ name: 'YanYu Cloud Team' }],
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  generator: 'v0.app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
