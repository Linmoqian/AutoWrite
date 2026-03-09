import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "小说创作看板",
  description: "AI小说创作进度管理看板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
