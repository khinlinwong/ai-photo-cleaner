import React from 'react';
import DesktopShell from '@/components/desktop/DesktopShell';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Photo Cleaner 桌面原型',
  description: 'AI Photo Cleaner 桌面软件架构原型与交互设计骨架。',
};

export default function DesktopPage() {
  return <DesktopShell />;
}
