import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "亚马逊 HTML 转换器 — 卖家后台兼容工具",
  description: "将 Word、飞书、网页文案一键转换为 Amazon Listing 可用 HTML",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
