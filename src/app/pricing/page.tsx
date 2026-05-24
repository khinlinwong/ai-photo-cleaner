'use client';

import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Check, HelpCircle, Sparkles } from 'lucide-react';

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('annually');

  const plans = [
    {
      name: '免费体验版',
      description: '适合轻度旅行者进行单次照片诊断',
      price: { monthly: 0, annually: 0 },
      features: [
        '每月 50 张照片免费诊断',
        '基础模糊度 (失焦) 筛查',
        '基础曝光度 (过曝/欠曝) 筛查',
        '100% 本地隐私沙盒运行',
        '单张手动下载/保留'
      ],
      cta: '立即免费体验',
      popular: false,
      href: '/upload'
    },
    {
      name: '专业旅行家',
      description: '无限制使用，解锁 AI 感知哈希去重与批量管理',
      price: { monthly: 9, annually: 7.2 },
      features: [
        '无限照片导入与诊断',
        '高精度拉普拉斯模糊检测',
        '相似照片智能归类 (pHash 感知)',
        '一键批量删除/导出',
        '新功能优先体验权',
        '7 × 24 小时专属客服支持'
      ],
      cta: '立即升级 Pro',
      popular: true,
      href: '/upload'
    },
    {
      name: '影楼工作室',
      description: '为独立摄影师与影楼工作室定制的高能管家',
      price: { monthly: 29, annually: 23.2 },
      features: [
        'Pro 版本所有功能',
        '多设备/多浏览器授权同步',
        '后期对接 Cloudflare R2 云端冷备份',
        '开放底层照片诊断 API 接口',
        '专属高性能 WebAssembly 加速通道',
        '企业发票与定制服务支持'
      ],
      cta: '联系我们合作',
      popular: false,
      href: 'mailto:support@aiphotocleaner.com'
    }
  ];

  const faqs = [
    {
      question: '照片真的不会上传云端吗？',
      answer: '绝对不会。AI Photo Cleaner 的核心图像分析算法（模糊度算法、曝光亮度检测、pHash 算法）完全在您的浏览器本地沙箱中执行。除非您在「工作室版」中主动勾选云端备份，否则您的任何照片都不会经过我们的服务器。'
    },
    {
      question: '免费版和 Pro 版的检测精度有什么不同吗？',
      answer: '免费版使用的是简化版的算法模型，对轻微失焦可能无法做到极高精度的识别。Pro 版则启用了高精度的拉普拉斯算子矩阵以及更细致的直方图动态范围检测，能对像素进行更加精密的物理诊断。'
    },
    {
      question: '按年付款怎么收费？可以随时取消吗？',
      answer: '如果选择按年付款，我们将一次性收取 12 个月的费用（享受 8 折优惠）。您可以随时在控制面板中取消订阅，订阅到期后将不再续扣费。'
    },
    {
      question: '支持退款吗？',
      answer: '是的。我们对产品质量充满信心，并提供 7 天内无理由全额退款承诺。如果您在使用过程中不满意，只需联系我们的客服，我们将全额返还您的订阅费用。'
    }
  ];

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-grid-pattern">
      <div className="bg-grid-glow" />
      <Header />

      <main className="flex-grow container mx-auto px-4 py-16 sm:px-6 lg:px-8 relative z-10">
        
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">简单透明的价格方案</h1>
          <p className="text-slate-400 mt-3 text-sm sm:text-base">
            选择最适合您的计划，彻底告别相机垃圾照片，留下完美回忆。
          </p>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <span className={`text-xs sm:text-sm font-semibold transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-slate-500'}`}>
              按月付款
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annually' : 'monthly')}
              className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-slate-800 p-0.5 transition-colors duration-200 focus-visible:outline-none"
            >
              <span
                className={`pointer-events-none block h-5 w-5 rounded-full bg-indigo-500 shadow-lg ring-0 transition-transform duration-200 ${
                  billingCycle === 'annually' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${billingCycle === 'annually' ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}>
              按年付款 (8折)
              <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] text-indigo-300">
                省 20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-24">
          {plans.map((plan, index) => {
            const price = billingCycle === 'annually' ? plan.price.annually : plan.price.monthly;
            
            return (
              <Card
                key={index}
                className={`glassmorphism rounded-3xl p-8 flex flex-col justify-between relative transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular 
                    ? 'border-indigo-500/40 shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)] animate-glow-border' 
                    : 'border-white/5'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-lg flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    最受欢迎
                  </div>
                )}

                <div>
                  {/* Plan Meta */}
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed min-h-[32px]">{plan.description}</p>

                  {/* Price */}
                  <div className="mt-6 flex items-baseline gap-1 text-white">
                    <span className="text-2xl font-bold font-mono">¥</span>
                    <span className="text-5xl font-extrabold font-mono tracking-tight">{price}</span>
                    <span className="text-xs text-slate-500 ml-1">/ 月</span>
                  </div>
                  {billingCycle === 'annually' && plan.price.annually > 0 && (
                    <p className="text-[10px] text-indigo-400 mt-1 font-semibold">每年仅需 ¥{Math.round(plan.price.annually * 12)}（省 ¥{Math.round((plan.price.monthly - plan.price.annually) * 12)}）</p>
                  )}

                  {/* Features List */}
                  <ul className="mt-8 space-y-3.5 border-t border-white/5 pt-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                        <Check className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="mt-8">
                  <Button
                    onClick={() => {
                      if (plan.href.startsWith('mailto:')) {
                        window.location.href = plan.href;
                      } else {
                        window.location.href = plan.href;
                      }
                    }}
                    className={`w-full font-bold text-xs py-5 rounded-xl transition-all ${
                      plan.popular
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0 shadow-lg shadow-indigo-500/25'
                        : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* FAQ Accordion Section */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <HelpCircle className="h-5 w-5 text-indigo-400" />
              常见问题解答
            </h2>
            <p className="text-xs text-slate-500 mt-1.5">关于我们照片清理服务的隐私与付费解答</p>
          </div>

          <Card className="glassmorphism p-6 rounded-3xl">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`} className="border-white/5 last:border-0">
                  <AccordionTrigger className="text-sm font-semibold text-slate-200 hover:text-white hover:no-underline text-left py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-slate-400 leading-relaxed pb-4">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>

      </main>

      <Footer />
    </div>
  );
}
