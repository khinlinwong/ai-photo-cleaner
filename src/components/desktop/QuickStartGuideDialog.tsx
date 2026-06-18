"use client";

import React, { useState } from 'react';
import { 
  Play, 
  Search, 
  GitCompare, 
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface QuickStartGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export const QuickStartGuideDialog: React.FC<QuickStartGuideDialogProps> = ({
  open,
  onOpenChange,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Step 1：选择照片",
      description: "选择照片或文件夹开始。本软件目前单次最多处理 200 张照片，超过会提示。",
      icon: Play,
      iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "Step 2：本地分析",
      description: "照片只在你的电脑上处理，不上传云端，也不会修改原图。",
      icon: Search,
      iconColor: "text-sky-400 bg-sky-500/10 border-sky-500/20",
    },
    {
      title: "Step 3：整理与对比",
      description: "软件会把照片放入“保留”和“淘汰候选”两类。相似照片可以用 A/B 对比慢慢挑选，最终决定权在你手上。",
      icon: GitCompare,
      iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
    {
      title: "Step 4：导出结果",
      description: "Keep 文件夹导出只会复制“保留”照片，原照片保持完整，不会被移动、改写或移除。CSV / JSON 可保存整理记录。",
      icon: Download,
      iconColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
  ];

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleCloseAndComplete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onComplete();
    onOpenChange(false);
    // Reset step for next manual launch
    setTimeout(() => setCurrentStep(0), 200);
  };

  const activeStep = steps[currentStep];
  const IconComponent = activeStep.icon;

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) {
        // Closed via X button or clicking outside -> count as complete to avoid annoying popups
        onComplete();
        setTimeout(() => setCurrentStep(0), 200);
      }
    }}>
      <DialogContent className="max-w-md bg-[#181E24] text-xs text-[var(--dt-text-secondary)] border border-white/10 rounded-xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] outline-none">
        <DialogHeader className="border-b border-white/5 pb-2">
          <DialogTitle className="text-sm font-bold text-[var(--dt-text-primary)]">
            快速开始
          </DialogTitle>
          <DialogDescription className="text-[11px] text-[var(--dt-text-muted)] mt-1">
            用 4 步了解本地照片整理流程。
          </DialogDescription>
        </DialogHeader>

        {/* Step Content */}
        <div className="py-6 flex flex-col items-center text-center space-y-4">
          <div className={`p-4 rounded-full border ${activeStep.iconColor} shrink-0`}>
            <IconComponent className="w-8 h-8 stroke-[1.8]" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h4 className="text-sm font-bold text-[var(--dt-text-primary)]">
              {activeStep.title}
            </h4>
            <p className="text-[11px] text-[var(--dt-text-secondary)] leading-relaxed min-h-[44px]">
              {activeStep.description}
            </p>
          </div>
        </div>

        {/* Alpha note footer */}
        <p className="text-[9px] text-[var(--dt-text-muted)] text-center leading-normal max-w-xs mx-auto mb-2 select-none">
          💡 Alpha 测试版的最近项目记录只保存在本机 App profile 中；卸载重装可能清空这些摘要，但绝对不会影响您的原图或已导出文件。
        </p>

        {/* Progress dots */}
        <div className="flex justify-center space-x-1.5 mb-4">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                idx === currentStep 
                  ? 'bg-emerald-400 w-3' 
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Footer controls */}
        <DialogFooter className="border-t border-white/5 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left link button on last step */}
          {currentStep === steps.length - 1 ? (
            <button
              type="button"
              onClick={handleCloseAndComplete}
              className="text-[10px] text-[var(--dt-text-muted)] hover:text-[var(--dt-text-primary)] underline transition-colors order-last sm:order-first"
            >
              不再自动显示
            </button>
          ) : (
            <div className="w-1" /> // Spacer
          )}

          <div className="flex items-center space-x-2 shrink-0">
            {currentStep > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                size="sm"
                className="text-xs h-8 px-3 bg-transparent border-white/10 hover:bg-white/5 hover:text-white"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                上一步
              </Button>
            )}

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                size="sm"
                className="text-xs h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-[#0E1612] font-semibold"
              >
                下一步
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseAndComplete}
                  size="sm"
                  className="text-xs h-8 px-3 bg-transparent border-white/10 hover:bg-white/5 hover:text-white"
                >
                  我知道了
                </Button>
                <Button
                  type="button"
                  onClick={handleCloseAndComplete}
                  size="sm"
                  className="text-xs h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-[#0E1612] font-semibold"
                >
                  开始整理照片
                </Button>
              </div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
