import React, { useState } from 'react';
import { BestSellerSlice, MonthlySalesPoint, formatBaht, formatNumber } from '../utils/calculations';

interface DonutChartProps {
  slices: BestSellerSlice[];
}

export const BestSellersDonutChart: React.FC<DonutChartProps> = ({ slices }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const totalRevenue = slices.reduce((sum, s) => sum + s.revenue, 0);
  const totalUnits = slices.reduce((sum, s) => sum + s.unitsSold, 0);

  if (slices.length === 0 || totalRevenue === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#E8D4D8] bg-[#FDF9F4] px-4 text-center">
        <p className="text-sm font-medium text-[#5A4448]">ยังไม่มียอดขายจากล็อตการจัดส่งในช่วงเวลานี้</p>
        <p className="mt-1 text-xs text-[#8A7075]">
          ระบบจะคำนวณสินค้าขายดีอัตโนมัติเมื่อมีการบันทึกล็อตการจัดส่งงาน
        </p>
      </div>
    );
  }

  const size = 200;
  const center = size / 2;
  const radius = 74;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;
  const activeSlice = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#F7ECEE"
            strokeWidth={strokeWidth}
          />
          {slices.map((slice, idx) => {
            const pct = totalRevenue > 0 ? slice.revenue / totalRevenue : 0;
            const dashLength = Math.max(0, pct * circumference);
            const dashOffset = -cumulativePercent * circumference;
            cumulativePercent += pct;
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={slice.name}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 5 : strokeWidth}
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={dashOffset}
                className="cursor-pointer transition-all duration-150"
                style={{
                  opacity: hoveredIdx === null || isHovered ? 1 : 0.45,
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="text-[11px] font-medium text-[#7A6368]">
            {activeSlice ? activeSlice.name : 'ยอดรวมจากล็อตส่ง'}
          </span>
          <span className="font-mono-num mt-0.5 text-base font-semibold text-[#3B2D30]">
            {activeSlice ? formatBaht(activeSlice.revenue) : formatBaht(totalRevenue)}
          </span>
          <span className="font-mono-num text-[11px] text-[#7A6368]">
            {activeSlice
              ? `${activeSlice.unitsSold} ชิ้น (${activeSlice.sharePercent}%)`
              : `${formatNumber(totalUnits)} ชิ้น`}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-2.5">
        {slices.slice(0, 6).map((slice, idx) => (
          <div
            key={slice.name}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 transition-colors ${
              hoveredIdx === idx ? 'bg-[#FDF2F4]' : 'hover:bg-[#FAF5EF]'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: slice.color }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[#3B2D30]">{slice.name}</p>
                <p className="text-xs text-[#7A6368]">{slice.category}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono-num text-sm font-semibold text-[#3B2D30]">
                {formatBaht(slice.revenue)}
              </p>
              <p className="font-mono-num text-xs text-[#7A6368]">
                {slice.unitsSold} ชิ้น · {slice.sharePercent}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface MonthlyBarChartProps {
  data: MonthlySalesPoint[];
  selectedMonth: number | 'all';
  onSelectMonth: (month: number | 'all') => void;
  includeShipping: boolean;
}

export const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({
  data,
  selectedMonth,
  onSelectMonth,
  includeShipping,
}) => {
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const values = data.map((d) =>
    includeShipping ? d.totalWithShipping : d.revenueExclShipping
  );
  const maxVal = Math.max(...values, 1000);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map(
    (ratio) => Math.round((maxVal * ratio) / 100) * 100 || Math.round(maxVal * ratio)
  );

  return (
    <div className="w-full">
      <div className="relative flex h-64 items-end gap-2 pt-8 pb-2">
        {/* Horizontal grid lines */}
        <div className="pointer-events-none absolute inset-x-0 top-8 bottom-8 flex flex-col justify-between">
          {yTicks.map((tick, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-mono-num w-14 shrink-0 text-right text-[11px] text-[#8E767B]">
                {tick > 0 ? formatNumber(tick) : '0'}
              </span>
              <div className="h-px flex-1 bg-[#F2E5E2]" />
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="relative z-10 ml-16 flex h-full flex-1 items-end gap-1.5 sm:gap-2.5">
          {data.map((point) => {
            const val = includeShipping ? point.totalWithShipping : point.revenueExclShipping;
            const heightPct = maxVal > 0 ? Math.max(val > 0 ? 4 : 0, (val / maxVal) * 100) : 0;
            const isSelected = selectedMonth === point.monthIndex;
            const isHovered = hoveredMonth === point.monthIndex;
            const isDimmed = selectedMonth !== 'all' && !isSelected;

            return (
              <div
                key={point.monthIndex}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
              >
                {/* Hover tooltip */}
                {isHovered && (
                  <div className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[#E7D4D7] bg-[#3B2D30] px-2.5 py-1.5 text-xs text-[#FFF9FA] shadow-sm">
                    <div className="font-medium">{point.fullLabel}</div>
                    <div className="font-mono-num text-[#F7C5CE]">
                      {formatBaht(val)} ({point.unitsShipped} ชิ้น)
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    onSelectMonth(isSelected ? 'all' : point.monthIndex)
                  }
                  onMouseEnter={() => setHoveredMonth(point.monthIndex)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  aria-label={`${point.fullLabel}: ${formatBaht(val)}`}
                  className="flex h-[calc(100%-24px)] w-full items-end justify-center focus:outline-none"
                >
                  <div
                    className="w-full max-w-[32px] rounded-t-md transition-all duration-200"
                    style={{
                      height: `${heightPct}%`,
                      minHeight: val > 0 ? '4px' : '2px',
                      backgroundColor:
                        val === 0
                          ? '#F3E8E6'
                          : isSelected || isHovered
                          ? '#B5566A'
                          : isDimmed
                          ? '#EBC7CE'
                          : '#C96A7E',
                    }}
                  />
                </button>

                <span
                  className={`mt-1.5 text-[11px] font-medium whitespace-nowrap ${
                    isSelected ? 'text-[#B5566A] font-semibold' : 'text-[#7A6368]'
                  }`}
                >
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-right text-xs text-[#8A7075]">
        คลิกที่แท่งเดือนเพื่อดูยอดขายเฉพาะเดือนนั้น หรือคลิกซ้ำเพื่อดูทั้งปี
      </p>
    </div>
  );
};
