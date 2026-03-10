import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC, ZCOOL_XiaoWei } from "next/font/google";
import "./globals.css";

// 正文衬线字体 - 温润典雅
const notoSerif = Noto_Serif_SC({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// 标题展示字体 - 书法风格
const zcoolXiaoWei = ZCOOL_XiaoWei({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "墨韵书斋 · 小说创作看板",
  description: "AI 驱动的小说创作管理系统 - 东方美学与现代科技的融合",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${notoSerif.variable} ${zcoolXiaoWei.variable}`}>
      <body className="antialiased min-h-screen overflow-hidden">
        {/* 宣纸纹理背景 */}
        <div className="paper-texture" aria-hidden="true" />

        {/* 跳转链接 - 无障碍 */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-red-700 focus:text-amber-50 focus:rounded-lg focus:font-medium"
        >
          跳转到主内容
        </a>

        {children}
      </body>
    </html>
  );
}
