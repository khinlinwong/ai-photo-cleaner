'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

type VirtualPhotoGridProps<T> = {
  items: T[];
  getItemKey: (item: T) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  minCardWidth: number;
  rowHeight: number;
  gap: number;
  overscanRows?: number;
  emptyState?: React.ReactNode;
  className?: string;
};

export default function VirtualPhotoGrid<T>({
  items,
  getItemKey,
  renderItem,
  minCardWidth,
  rowHeight,
  gap,
  overscanRows = 3,
  emptyState,
  className,
}: VirtualPhotoGridProps<T>) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(2);
  const [visibleRange, setVisibleRange] = useState({ startRow: 0, endRow: 10 });

  // 寻找外层最近的滚动容器
  const getScrollContainer = useCallback((element: HTMLElement | null): HTMLElement => {
    if (!element) return document.documentElement;
    let parent = element.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return parent;
      }
      parent = parent.parentElement;
    }
    return document.documentElement;
  }, []);

  // 更新可见的行范围
  const updateVisibleRange = useCallback(() => {
    if (!gridRef.current) return;
    const gridEl = gridRef.current;
    const scrollContainer = getScrollContainer(gridEl);
    
    const gridRect = gridEl.getBoundingClientRect();
    
    // 获取滚动容器视口相对于视口的 rect
    let containerRect: { top: number; bottom: number; height: number };
    if (scrollContainer === document.documentElement) {
      containerRect = { top: 0, bottom: window.innerHeight, height: window.innerHeight };
    } else {
      const rect = scrollContainer.getBoundingClientRect();
      containerRect = { top: rect.top, bottom: rect.bottom, height: rect.height };
    }

    // 计算滚动视口顶部和底部在 gridEl 自身坐标系下的偏移
    const localScrollTop = Math.max(0, containerRect.top - gridRect.top);
    const localScrollBottom = Math.max(0, containerRect.bottom - gridRect.top);

    const totalRows = Math.ceil(items.length / columns);
    
    let startRow = Math.max(0, Math.floor(localScrollTop / (rowHeight + gap)) - overscanRows);
    let endRow = Math.min(totalRows, Math.ceil(localScrollBottom / (rowHeight + gap)) + overscanRows);

    // 安全边界校正
    if (startRow >= totalRows && totalRows > 0) {
      startRow = Math.max(0, totalRows - 1);
    }
    if (endRow < startRow) {
      endRow = startRow;
    }

    setVisibleRange((prev) => {
      if (prev.startRow === startRow && prev.endRow === endRow) {
        return prev;
      }
      return { startRow, endRow };
    });
  }, [items.length, columns, rowHeight, gap, overscanRows, getScrollContainer]);

  // 监听容器大小改变来动态计算列数
  useEffect(() => {
    if (!gridRef.current) return;
    const gridEl = gridRef.current;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0) {
          // 自适应计算列数，并限制在 2 - 4 列之间以对齐原设计
          const cols = Math.min(4, Math.max(2, Math.floor((width + gap) / (minCardWidth + gap))));
          setColumns(cols);
        }
      }
    });

    resizeObserver.observe(gridEl);
    return () => {
      resizeObserver.disconnect();
    };
  }, [minCardWidth, gap]);

  // 监听滚动事件和窗口调整事件
  useEffect(() => {
    if (!gridRef.current) return;
    const gridEl = gridRef.current;
    const scrollContainer = getScrollContainer(gridEl);

    const handleScroll = () => {
      updateVisibleRange();
    };

    // 监听 scroll 与 resize
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    // 初始执行一次
    updateVisibleRange();

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [updateVisibleRange, getScrollContainer]);

  // 当列表长度或者列数改变时重新校准可见范围
  useEffect(() => {
    updateVisibleRange();
  }, [items, columns, updateVisibleRange]);

  if (items.length === 0) {
    return <div className={className}>{emptyState}</div>;
  }

  const totalRows = Math.ceil(items.length / columns);
  const { startRow, endRow } = visibleRange;

  const topPadding = startRow * (rowHeight + gap);
  const bottomPadding = Math.max(0, (totalRows - endRow) * (rowHeight + gap));

  // 提取当前可见的数据子集
  const startIndex = startRow * columns;
  const endIndex = Math.min(items.length, endRow * columns);
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div ref={gridRef} className={className}>
      {/* 顶部高度填充占位 */}
      {topPadding > 0 && <div style={{ height: `${topPadding}px` }} />}
      
      {/* 虚拟可视网格 */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: `${gap}px`,
        }}
      >
        {visibleItems.map((item, localIdx) => {
          const globalIndex = startIndex + localIdx;
          return (
            <div 
              key={getItemKey(item)} 
              style={{ height: `${rowHeight}px`, overflow: 'visible' }}
            >
              {renderItem(item, globalIndex)}
            </div>
          );
        })}
      </div>

      {/* 底部高度填充占位 */}
      {bottomPadding > 0 && <div style={{ height: `${bottomPadding}px` }} />}
    </div>
  );
}
