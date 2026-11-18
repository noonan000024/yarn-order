import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Calendar, Package, ShoppingBag, TrendingUp } from 'lucide-react';
import { AppData, PageTab } from '../types/studio';
import {
  THAI_MONTHS_FULL,
  calculateBestSellersFromLots,
  calculateMonthlySalesFromLots,
  filterLotsByPeriod,
  formatBaht,
  formatNumber,
  getAvailableYearsFromLots,
} from '../utils/calculations';
import { BestSellersDonutChart, MonthlyBarChart } from './Charts';

interface DashboardViewProps {
  data: AppData;
  onNavigate: (tab: PageTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data, onNavigate }) => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const availableYears = useMemo(
    () => getAvailableYearsFromLots(data.shippingLots, data.orders),
    [data.shippingLots, data.orders]
  );

  const [selectedYear, setSelectedYear] = useState<number>(
    availableYears.includes(currentYear) ? currentYear : availableYears[0] || currentYear
  );
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');
  const [includeShipping, setIncludeShipping] = useState<boolean>(false);

  const shippedOrdersCount = useMemo(
    () => data.orders.filter((o) => o.status === 'ส่งครบแล้ว').length,
    [data.orders]
  );
  const inProgressOrdersCount = useMemo(
    () => data.orders.filter((o) => o.status !== 'ส่งครบแล้ว').length,
    [data.orders]
  );

  const thisMonthLots = useMemo(
    () => filterLotsByPeriod(data.shippingLots, currentYear, currentMonth),
    [data.shippingLots, currentYear, currentMonth]
  );
  const thisMonthProductRevenue = useMemo(
    () =>
      thisMonthLots.reduce(
        (sum, l) => sum + Number(l.quantityShipped || 0) * Number(l.unitPrice || 0),
        0
      ),
    [thisMonthLots]
  );
  const thisMonthTotalWithShipping = useMemo(
    () => thisMonthLots.reduce((sum, l) => sum + Number(l.totalAmount || 0), 0),
    [thisMonthLots]
  );

  const monthlySeries = useMemo(
    () => calculateMonthlySalesFromLots(data.shippingLots, selectedYear),
    [data.shippingLots, selectedYear]
  );

  const selectedLots = useMemo(
    () => filterLotsByPeriod(data.shippingLots, selectedYear, selectedMonth),
    [data.shippingLots, selectedYear, selectedMonth]
  );

  const selectedRevenue = useMemo(() => {
    return selectedLots.reduce((sum, l) => {
      const prod = Number(l.quantityShipped || 0) * Number(l.unitPrice || 0);
      return sum + (includeShipping ? prod + Number(l.shippingFee || 0) : prod);
    }, 0);
  }, [selectedLots, includeShipping]);

  const selectedUnits = useMemo(
    () => selectedLots.reduce((sum, l) => sum + Number(l.quantityShipped || 0), 0),
    [selectedLots]
  );

  const bestSellers = useMemo(
    () => calculateBestSellersFromLots(data.shippingLots, selectedYear, selectedMonth),
    [data.shippingLots, selectedYear, selectedMonth]
  );

  const yearlyTotals = useMemo(() => {
    return availableYears.map((yr) => {
      const yrLots = filterLotsByPeriod(data.shippingLots, yr, 'all');
      const prodSales = yrLots.reduce(
        (sum, l) => sum + Number(l.quantityShipped || 0) * Number(l.unitPrice || 0),
        0
      );
      const shippingTotal = yrLots.reduce((sum, l) => sum + Number(l.shippingFee || 0), 0);
      const units = yrLots.reduce((sum, l) => sum + Number(l.quantityShipped || 0), 0);
      return {
        year: yr,
        lotCount: yrLots.length,
        units,
        prodSales,
        shippingTotal,
        grandTotal: prodSales + shippingTotal,
      };
    });
  }, [availableYears, data.shippingLots]);

  const periodLabel =
    selectedMonth === 'all'
      ? `ทั้งปี ${selectedYear + 543}`
      : `${THAI_MONTHS_FULL[selectedMonth - 1]} ${selectedYear + 543}`;

  return (
    <div className="space-y-6">
      {/* Period Control Strip */}
      <div className="flex flex-col gap-3 rounded-xl border border-[#EDDCD9] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#5A4448] mr-1">
            <Calendar className="h-4 w-4 text-[#C96A7E]" />
            <span>ดูสรุปยอด:</span>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-[#FAF1EC] p-1">
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedYear === yr
                    ? 'bg-white text-[#B5566A] shadow-xs'
                    : 'text-[#7A6368] hover:text-[#3B2D30]'
                }`}
              >
                ปี {yr + 543}
              </button>
            ))}
          </div>

          <select
            aria-label="เลือกเดือน"
            value={selectedMonth}
            onChange={(e) =>
              setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="min-h-[34px] rounded-lg border border-[#E7D4D7] bg-white px-3 py-1.5 text-xs font-medium text-[#3B2D30] focus:border-[#C96A7E] focus:outline-none"
          >
            <option value="all">ทุกเดือน (สรุปรายปี)</option>
            {THAI_MONTHS_FULL.map((mName, idx) => (
              <option key={mName} value={idx + 1}>
                เดือน{mName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg bg-[#FAF1EC] p-1 sm:self-auto">
          <button
            type="button"
            onClick={() => setIncludeShipping(false)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              !includeShipping
                ? 'bg-white text-[#3E7255] shadow-xs'
                : 'text-[#7A6368] hover:text-[#3B2D30]'
            }`}
          >
            ยอดขายสินค้า (ไม่รวมค่าส่ง)
          </button>
          <button
            type="button"
            onClick={() => setIncludeShipping(true)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              includeShipping
                ? 'bg-white text-[#3E7255] shadow-xs'
                : 'text-[#7A6368] hover:text-[#3B2D30]'
            }`}
          >
            ยอดรวมค่าส่ง
          </button>
        </div>
      </div>

      {/* 4-column KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate('orders')}
          className="group rounded-xl border border-[#EDDCD9] bg-white p-5 text-left transition-colors hover:border-[#DFAEB8]"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#7A6368]">
            <span>ออเดอร์ที่ส่งไปแล้ว</span>
            <Package className="h-4 w-4 text-[#4E8767]" />
          </div>
          <div className="font-mono-num mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-[#3B2D30]">
              {formatNumber(shippedOrdersCount)}
            </span>
            <span className="text-xs text-[#7A6368]">ออเดอร์</span>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs text-[#3E7255]">
            <span>ดูใบออเดอร์ทั้งหมด</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('tasks')}
          className="group rounded-xl border border-[#EDDCD9] bg-white p-5 text-left transition-colors hover:border-[#DFAEB8]"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#7A6368]">
            <span>ออเดอร์ที่กำลังทำ</span>
            <ShoppingBag className="h-4 w-4 text-[#C96A7E]" />
          </div>
          <div className="font-mono-num mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-[#3B2D30]">
              {formatNumber(inProgressOrdersCount)}
            </span>
            <span className="text-xs text-[#7A6368]">ออเดอร์</span>
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs text-[#B5566A]">
            <span>จัดการคิวงานถัก</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </p>
        </button>

        <div className="rounded-xl border border-[#EDDCD9] bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#7A6368]">
            <span>ยอดเงินเดือนนี้ ({THAI_MONTHS_FULL[currentMonth - 1]})</span>
            <TrendingUp className="h-4 w-4 text-[#4E8767]" />
          </div>
          <div className="font-mono-num mt-3 text-3xl font-semibold tracking-tight text-[#3E7255]">
            {formatBaht(includeShipping ? thisMonthTotalWithShipping : thisMonthProductRevenue)}
          </div>
          <p className="font-mono-num mt-2 text-xs text-[#7A6368]">
            จาก {thisMonthLots.length} ล็อตส่งของเดือนนี้
          </p>
        </div>

        <div className="rounded-xl border border-[#EDDCD9] bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#7A6368]">
            <span>สรุปยอดช่วงที่เลือก</span>
            <span className="text-[11px] font-medium text-[#B5566A]">{periodLabel}</span>
          </div>
          <div className="font-mono-num mt-3 text-3xl font-semibold tracking-tight text-[#B5566A]">
            {formatBaht(selectedRevenue)}
          </div>
          <p className="font-mono-num mt-2 text-xs text-[#7A6368]">
            ส่งแล้ว {formatNumber(selectedUnits)} ชิ้น · {selectedLots.length} ล็อต
          </p>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-[#EDDCD9] bg-white p-5 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#3B2D30]">
                ยอดขายรายเดือน ปี {selectedYear + 543}
              </h2>
              <p className="mt-0.5 text-xs text-[#7A6368]">
                คำนวณจากล็อตการส่งของจริงในแต่ละเดือน (
                {includeShipping ? 'รวมค่าส่ง' : 'เฉพาะยอดสินค้าไม่รวมค่าส่ง'})
              </p>
            </div>
            {selectedMonth !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedMonth('all')}
                className="rounded-lg border border-[#E7D4D7] px-2.5 py-1 text-xs font-medium text-[#5A4448] hover:bg-[#FAF1EC]"
              >
                ดูครบทั้ง 12 เดือน
              </button>
            )}
          </div>

          <MonthlyBarChart
            data={monthlySeries}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            includeShipping={includeShipping}
          />
        </div>

        <div className="rounded-xl border border-[#EDDCD9] bg-white p-5 lg:col-span-5">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#3B2D30]">สินค้าขายดี</h2>
              <p className="mt-0.5 text-xs text-[#7A6368]">
                สัดส่วนยอดขายสินค้าจากล็อตการส่ง · {periodLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="text-xs font-medium text-[#B5566A] hover:underline whitespace-nowrap shrink-0"
            >
              ดูสินค้าทั้งหมด
            </button>
          </div>

          <BestSellersDonutChart slices={bestSellers} />
        </div>
      </div>

      {/* Monthly & Yearly Summary Breakdown Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-[#EDDCD9] bg-white p-5 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#3B2D30]">
                ตารางสรุปยอดแต่ละเดือน (ปี {selectedYear + 543})
              </h2>
              <p className="mt-0.5 text-xs text-[#7A6368]">
                อ้างอิงข้อมูลจากล็อตการจัดส่งของทั้งหมด
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#EDDCD9] text-xs font-medium text-[#7A6368]">
                  <th className="py-2.5 pr-4">เดือน</th>
                  <th className="py-2.5 px-3 text-right">จำนวนล็อต</th>
                  <th className="py-2.5 px-3 text-right">จำนวนชิ้นที่ส่ง</th>
                  <th className="py-2.5 px-3 text-right">ยอดขายสินค้า</th>
                  <th className="py-2.5 px-3 text-right">ค่าส่ง</th>
                  <th className="py-2.5 pl-3 text-right">รวมเป็นเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7ECE9]">
                {monthlySeries
                  .filter((m) => m.lotCount > 0 || selectedMonth === m.monthIndex)
                  .map((m) => (
                    <tr
                      key={m.monthIndex}
                      onClick={() =>
                        setSelectedMonth(selectedMonth === m.monthIndex ? 'all' : m.monthIndex)
                      }
                      className={`cursor-pointer transition-colors hover:bg-[#FCF5EE] ${
                        selectedMonth === m.monthIndex ? 'bg-[#FCECEF]/70' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-4 font-medium text-[#3B2D30]">{m.fullLabel}</td>
                      <td className="font-mono-num py-2.5 px-3 text-right text-[#5A4448]">
                        {formatNumber(m.lotCount)}
                      </td>
                      <td className="font-mono-num py-2.5 px-3 text-right text-[#5A4448]">
                        {formatNumber(m.unitsShipped)}
                      </td>
                      <td className="font-mono-num py-2.5 px-3 text-right font-medium text-[#3B2D30]">
                        {formatBaht(m.revenueExclShipping)}
                      </td>
                      <td className="font-mono-num py-2.5 px-3 text-right text-[#7A6368]">
                        {formatBaht(m.shippingFeeTotal)}
                      </td>
                      <td className="font-mono-num py-2.5 pl-3 text-right font-semibold text-[#3E7255]">
                        {formatBaht(m.totalWithShipping)}
                      </td>
                    </tr>
                  ))}
                {monthlySeries.every((m) => m.lotCount === 0) && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-[#987E83]">
                      ยังไม่มีล็อตการจัดส่งในปี {selectedYear + 543}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-[#EDDCD9] bg-white p-5 lg:col-span-4">
          <h2 className="text-base font-semibold text-[#3B2D30]">สรุปยอดขายรายปี</h2>
          <p className="mt-0.5 text-xs text-[#7A6368]">
            คลิกเลือกปีเพื่อดูรายละเอียดรายเดือน
          </p>

          <div className="mt-4 divide-y divide-[#F7ECE9]">
            {yearlyTotals.map((yt) => (
              <button
                key={yt.year}
                type="button"
                onClick={() => {
                  setSelectedYear(yt.year);
                  setSelectedMonth('all');
                }}
                className={`flex w-full items-center justify-between py-3 px-2.5 text-left transition-colors hover:bg-[#FCF5EE] rounded-lg ${
                  selectedYear === yt.year ? 'bg-[#E8F3EC]/70' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-[#3B2D30]">
                    ปี {yt.year + 543}
                  </p>
                  <p className="font-mono-num text-xs text-[#7A6368]">
                    {yt.lotCount} ล็อต · {formatNumber(yt.units)} ชิ้น
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono-num text-sm font-semibold text-[#3E7255]">
                    {formatBaht(yt.prodSales)}
                  </p>
                  <p className="font-mono-num text-[11px] text-[#7A6368]">
                    รวมค่าส่ง {formatBaht(yt.grandTotal)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
