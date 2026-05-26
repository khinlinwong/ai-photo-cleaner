'use client';

import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/30 py-8 relative overflow-hidden select-none bg-[#C8CDD6]/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
        <p className="text-[10px] text-[#7B8492] leading-normal">
          © {new Date().getFullYear()} AI Photo Cleaner. 照片只在本地浏览器中处理，不会上传到云端。保护您的隐私。
        </p>
      </div>
    </footer>
  );
};
