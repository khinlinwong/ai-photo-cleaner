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
  title: "AI Photo Cleaner - 智能筛选旅行废片，一键释放照片空间",
  description: "AI Photo Cleaner 利用先进的 AI 图像算法，智能检测模糊、过曝、欠曝的旅行废片，并将其分类整理为“建议保留”和“建议删除”，一键拯救您的相机与手机存储。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={cn("font-sans dark", inter.variable)} style={{ colorScheme: 'dark' }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100 min-h-screen`}
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
