import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { PhotoWorkspaceProvider } from "@/context/PhotoWorkspaceContext";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "AI Photo Cleaner - 浏览器本地照片诊断与筛选工具",
  description: "AI Photo Cleaner 是一款本地照片清理工具，在本地沙箱中诊断运动模糊、失焦、曝光异常及相似重复照片，并分类整理为“推荐保留”和“淘汰候选”，释放照片空间。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", inter.variable)} style={{ colorScheme: 'light' }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#C8CDD6] text-[#1F2937] font-sans min-h-screen`}
      >
        <PhotoWorkspaceProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </PhotoWorkspaceProvider>
      </body>
    </html>
  );
}
