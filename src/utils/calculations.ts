import { AppData, Order, Product, ShippingLot, TaskItem } from '../types/studio';

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export function formatBaht(amount: number): string {
  return `฿${Math.round(amount).toLocaleString('th-TH')}`;
}

export function formatNumber(val: number): string {
  return val.toLocaleString('th-TH');
}

export function formatThaiDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx > 11) {
    return dateStr;
  }
  return `${day} ${THAI_MONTHS_SHORT[monthIdx]} ${year + 543}`;
}

export function getShippedQtyForTask(task: TaskItem, shippingLots: ShippingLot[]): number {
  return shippingLots
    .filter((lot) => lot.taskId === task.id || (lot.orderId === task.orderId && lot.itemName === task.itemName && !lot.taskId))
    .reduce((sum, lot) => sum + Number(lot.quantityShipped || 0), 0);
}

export function getLatestLotInfoForTask(task: TaskItem, shippingLots: ShippingLot[]): {
  latestLotNumber: number | null;
  lotNumbers: number[];
  shippedQty: number;
} {
  const matchingLots = shippingLots.filter(
    (lot) => lot.taskId === task.id || (lot.orderId === task.orderId && lot.itemName === task.itemName && !lot.taskId)
  );
  const lotNumbers = Array.from(new Set(matchingLots.map((l) => l.lotNumber))).sort((a, b) => a - b);
  const latestLotNumber = lotNumbers.length > 0 ? lotNumbers[lotNumbers.length - 1] : null;
  const shippedQty = matchingLots.reduce((sum, lot) => sum + Number(lot.quantityShipped || 0), 0);
  return { latestLotNumber, lotNumbers, shippedQty };
}

export interface OrderSummaryMetrics {
  tasks: TaskItem[];
  lots: ShippingLot[];
  totalOrderedQty: number;
  totalShippedQty: number;
  progressPercent: number;
  totalAmountExclShipping: number;
  shippedAmountExclShipping: number;
  shippedAmountInclShipping: number;
  latestShipDate: string | null;
  lotBreakdown: { lotNumber: number; qty: number; shipDate: string; status: string }[];
  orderedItemsText: string;
}

export function getOrderMetrics(order: Order, data: AppData): OrderSummaryMetrics {
  const tasks = data.tasks.filter((t) => t.orderId === order.id);
  const lots = data.shippingLots
    .filter((l) => l.orderId === order.id)
    .sort((a, b) => a.lotNumber - b.lotNumber || a.shipDate.localeCompare(b.shipDate));

  const totalOrderedQty = tasks.reduce((sum, t) => sum + Number(t.quantityOrdered || 0), 0);
  const totalShippedQty = lots.reduce((sum, l) => sum + Number(l.quantityShipped || 0), 0);

  let progressPercent = 0;
  if (totalOrderedQty > 0) {
    progressPercent = Math.min(100, Math.round((totalShippedQty / totalOrderedQty) * 100));
  } else if (order.status === 'ส่งครบแล้ว') {
    progressPercent = 100;
  }

  const totalAmountExclShipping = tasks.reduce(
    (sum, t) => sum + Number(t.quantityOrdered || 0) * Number(t.unitPrice || 0),
    0
  );

  const shippedAmountExclShipping = lots.reduce(
    (sum, l) => sum + Number(l.quantityShipped || 0) * Number(l.unitPrice || 0),
    0
  );

  const shippedAmountInclShipping = lots.reduce(
    (sum, l) => sum + Number(l.totalAmount || 0),
    0
  );

  const latestShipDate = lots.length > 0
    ? lots.reduce((latest, l) => (l.shipDate > latest ? l.shipDate : latest), lots[0].shipDate)
    : null;

  // Group lots by lotNumber
  const lotMap = new Map<number, { lotNumber: number; qty: number; shipDate: string; status: string }>();
  for (const lot of lots) {
    const existing = lotMap.get(lot.lotNumber);
    if (existing) {
      existing.qty += Number(lot.quantityShipped || 0);
      if (lot.shipDate > existing.shipDate) existing.shipDate = lot.shipDate;
    } else {
      lotMap.set(lot.lotNumber, {
        lotNumber: lot.lotNumber,
        qty: Number(lot.quantityShipped || 0),
        shipDate: lot.shipDate,
        status: lot.status,
      });
    }
  }
  const lotBreakdown = Array.from(lotMap.values()).sort((a, b) => a.lotNumber - b.lotNumber);

  const orderedItemsText = tasks.length > 0
    ? tasks.map((t) => `${t.itemName} ×${t.quantityOrdered}`).join(', ')
    : 'ยังไม่มีรายการงาน';

  return {
    tasks,
    lots,
    totalOrderedQty,
    totalShippedQty,
    progressPercent,
    totalAmountExclShipping,
    shippedAmountExclShipping,
    shippedAmountInclShipping,
    latestShipDate,
    lotBreakdown,
    orderedItemsText,
  };
}

/**
 * Strictly calculates product sales from ShippingLots ONLY
 */
export interface ProductSalesMetric {
  product: Product;
  unitsSold: number;
  revenueExclShipping: number;
  lotCount: number;
}

export function calculateProductSalesFromLots(
  products: Product[],
  shippingLots: ShippingLot[],
  filterYear?: number | 'all',
  filterMonth?: number | 'all'
): ProductSalesMetric[] {
  const filteredLots = filterLotsByPeriod(shippingLots, filterYear, filterMonth);

  return products.map((product) => {
    const matchingLots = filteredLots.filter(
      (lot) => lot.itemName.trim().toLowerCase() === product.name.trim().toLowerCase()
    );
    const unitsSold = matchingLots.reduce((sum, l) => sum + Number(l.quantityShipped || 0), 0);
    const revenueExclShipping = matchingLots.reduce(
      (sum, l) => sum + Number(l.quantityShipped || 0) * Number(l.unitPrice || 0),
      0
    );
    return {
      product,
      unitsSold,
      revenueExclShipping,
      lotCount: matchingLots.length,
    };
  });
}

export interface BestSellerSlice {
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
  sharePercent: number;
  color: string;
}

const CHART_PALETTE = [
  '#C96A7E', // Sweet Rose Pink
  '#4E8767', // Soft Leaf Green
  '#E5989B', // Blossom Pink
  '#7EB292', // Mint Sage Green
  '#D9A566', // Warm Honey Cream
  '#B5838D', // Dusty Mauve
];

export function calculateBestSellersFromLots(
  shippingLots: ShippingLot[],
  filterYear?: number | 'all',
  filterMonth?: number | 'all'
): BestSellerSlice[] {
  const filteredLots = filterLotsByPeriod(shippingLots, filterYear, filterMonth);
  const grouped = new Map<string, { name: string; category: string; unitsSold: number; revenue: number }>();

  for (const lot of filteredLots) {
    const key = lot.itemName.trim();
    const lotRev = Number(lot.quantityShipped || 0) * Number(lot.unitPrice || 0);
    const existing = grouped.get(key);
    if (existing) {
      existing.unitsSold += Number(lot.quantityShipped || 0);
      existing.revenue += lotRev;
    } else {
      grouped.set(key, {
        name: key,
        category: lot.category,
        unitsSold: Number(lot.quantityShipped || 0),
        revenue: lotRev,
      });
    }
  }

  const sorted = Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue || b.unitsSold - a.unitsSold);
  const totalRevenue = sorted.reduce((sum, item) => sum + item.revenue, 0);

  return sorted.map((item, idx) => ({
    ...item,
    sharePercent: totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 1000) / 10 : 0,
    color: CHART_PALETTE[idx % CHART_PALETTE.length],
  }));
}

export function filterLotsByPeriod(
  lots: ShippingLot[],
  year?: number | 'all',
  month?: number | 'all' // 1..12
): ShippingLot[] {
  return lots.filter((lot) => {
    if (!lot.shipDate) return false;
    const [yStr, mStr] = lot.shipDate.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    if (year && year !== 'all' && y !== year) return false;
    if (month && month !== 'all' && m !== month) return false;
    return true;
  });
}

export interface MonthlySalesPoint {
  monthIndex: number; // 1..12
  label: string;
  fullLabel: string;
  revenueExclShipping: number;
  shippingFeeTotal: number;
  totalWithShipping: number;
  unitsShipped: number;
  lotCount: number;
}

export function calculateMonthlySalesFromLots(shippingLots: ShippingLot[], year: number): MonthlySalesPoint[] {
  const points: MonthlySalesPoint[] = THAI_MONTHS_SHORT.map((label, idx) => ({
    monthIndex: idx + 1,
    label,
    fullLabel: THAI_MONTHS_FULL[idx],
    revenueExclShipping: 0,
    shippingFeeTotal: 0,
    totalWithShipping: 0,
    unitsShipped: 0,
    lotCount: 0,
  }));

  for (const lot of shippingLots) {
    if (!lot.shipDate) continue;
    const [yStr, mStr] = lot.shipDate.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    if (y !== year || m < 1 || m > 12) continue;

    const target = points[m - 1];
    const prodRev = Number(lot.quantityShipped || 0) * Number(lot.unitPrice || 0);
    const fee = Number(lot.shippingFee || 0);
    target.revenueExclShipping += prodRev;
    target.shippingFeeTotal += fee;
    target.totalWithShipping += prodRev + fee;
    target.unitsShipped += Number(lot.quantityShipped || 0);
    target.lotCount += 1;
  }

  return points;
}

export function getAvailableYearsFromLots(shippingLots: ShippingLot[], orders: Order[]): number[] {
  const years = new Set<number>([new Date().getFullYear()]);
  for (const lot of shippingLots) {
    const y = parseInt((lot.shipDate || '').split('-')[0], 10);
    if (!isNaN(y) && y > 2000) years.add(y);
  }
  for (const ord of orders) {
    const y = parseInt((ord.orderDate || '').split('-')[0], 10);
    if (!isNaN(y) && y > 2000) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a);
}

export function generateNextOrderNo(orders: Order[]): string {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;
  let maxNum = 0;
  for (const ord of orders) {
    if (ord.orderNo.startsWith(prefix)) {
      const n = parseInt(ord.orderNo.slice(prefix.length), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
}
