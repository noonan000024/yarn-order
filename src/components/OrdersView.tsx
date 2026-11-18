import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  AppData,
  Order,
  OrderStatus,
  TaskItem,
} from '../types/studio';
import {
  THAI_MONTHS_FULL,
  filterLotsByPeriod,
  formatBaht,
  formatNumber,
  formatThaiDate,
  generateNextOrderNo,
  getAvailableYearsFromLots,
  getOrderMetrics,
} from '../utils/calculations';
import { ProductImage, StatusLabel } from './ProductDisplay';

interface OrdersViewProps {
  data: AppData;
  onSaveWithSync: (nextData: AppData, summary: { title: string; description: string; confirmLabel?: string; successMessage: string; isDestructive?: boolean }) => void;
  onQuickLogShipping: (orderId: string, taskId?: string) => void;
}

const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  'รอดำเนินการ',
  'กำลังถัก',
  'ส่งบางส่วน',
  'ส่งครบแล้ว',
];

export const OrdersView: React.FC<OrdersViewProps> = ({
  data,
  onSaveWithSync,
  onQuickLogShipping,
}) => {
  const now = new Date();
  const availableYears = useMemo(
    () => getAvailableYearsFromLots(data.shippingLots, data.orders),
    [data.shippingLots, data.orders]
  );

  const [summaryYear, setSummaryYear] = useState<number>(
    availableYears.includes(now.getFullYear()) ? now.getFullYear() : availableYears[0] || now.getFullYear()
  );
  const [summaryMonth, setSummaryMonth] = useState<number | 'all'>(now.getMonth() + 1);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ทั้งหมด'>('ทั้งหมด');

  const [selectedOrderDetailId, setSelectedOrderDetailId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const [orderNo, setOrderNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [status, setStatus] = useState<OrderStatus>('รอดำเนินการ');
  const [notes, setNotes] = useState('');
  const [initialProductId, setInitialProductId] = useState<string>('');
  const [initialQty, setInitialQty] = useState<number>(1);

  const yearlyRevenueExcl = useMemo(() => {
    const lots = filterLotsByPeriod(data.shippingLots, summaryYear, 'all');
    return lots.reduce(
      (sum, l) => sum + Number(l.quantityShipped || 0) * Number(l.unitPrice || 0),
      0
    );
  }, [data.shippingLots, summaryYear]);

  const monthlyRevenueExcl = useMemo(() => {
    const lots = filterLotsByPeriod(data.shippingLots, summaryYear, summaryMonth);
    return lots.reduce(
      (sum, l) => sum + Number(l.quantityShipped || 0) * Number(l.unitPrice || 0),
      0
    );
  }, [data.shippingLots, summaryYear, summaryMonth]);

  const filteredOrders = useMemo(() => {
    return data.orders
      .filter((ord) => {
        if (statusFilter !== 'ทั้งหมด' && ord.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const metrics = getOrderMetrics(ord, data);
          const match =
            ord.orderNo.toLowerCase().includes(q) ||
            ord.customerName.toLowerCase().includes(q) ||
            metrics.orderedItemsText.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.orderNo.localeCompare(a.orderNo));
  }, [data, searchQuery, statusFilter]);

  const openCreateModal = () => {
    setEditingOrder(null);
    setOrderNo(generateNextOrderNo(data.orders));
    setCustomerName('');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setStatus('รอดำเนินการ');
    setNotes('');
    setInitialProductId(data.products[0]?.id || '');
    setInitialQty(1);
    setIsFormOpen(true);
  };

  const openEditModal = (order: Order) => {
    setEditingOrder(order);
    setOrderNo(order.orderNo);
    setCustomerName(order.customerName);
    setOrderDate(order.orderDate);
    setStatus(order.status);
    setNotes(order.notes || '');
    setInitialProductId('');
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !orderNo.trim()) return;

    if (editingOrder) {
      const updatedOrders = data.orders.map((o) =>
        o.id === editingOrder.id
          ? {
              ...o,
              orderNo: orderNo.trim(),
              customerName: customerName.trim(),
              orderDate,
              status,
              notes: notes.trim() || undefined,
            }
          : o
      );
      const updatedTasks = data.tasks.map((t) =>
        t.orderId === editingOrder.id ? { ...t, orderNo: orderNo.trim() } : t
      );
      const updatedLots = data.shippingLots.map((l) =>
        l.orderId === editingOrder.id
          ? { ...l, orderNo: orderNo.trim(), customerName: customerName.trim() }
          : l
      );
      setIsFormOpen(false);
      onSaveWithSync(
        {
          ...data,
          orders: updatedOrders,
          tasks: updatedTasks,
          shippingLots: updatedLots,
        },
        {
          title: 'บันทึกการแก้ไขออเดอร์',
          description: `บันทึกข้อมูลออเดอร์ ${orderNo.trim()} (${customerName.trim()}) และสำรองข้อมูลลง Google Sheet ทันที`,
          successMessage: `อัปเดตออเดอร์ ${orderNo.trim()} เรียบร้อย`,
        }
      );
    } else {
      const newOrderId = `ord-${Date.now()}`;
      const newOrder: Order = {
        id: newOrderId,
        orderNo: orderNo.trim(),
        customerName: customerName.trim(),
        orderDate,
        status,
        notes: notes.trim() || undefined,
      };

      const nextTasks = [...data.tasks];
      if (initialProductId) {
        const prod = data.products.find((p) => p.id === initialProductId);
        if (prod && initialQty > 0) {
          const newTask: TaskItem = {
            id: `task-${Date.now()}`,
            orderId: newOrderId,
            orderNo: newOrder.orderNo,
            productId: prod.id,
            itemName: prod.name,
            category: prod.category,
            quantityOrdered: initialQty,
            unitPrice: prod.price,
            status: 'รอถัก',
            sampleImageUrl: prod.imageUrl,
          };
          nextTasks.unshift(newTask);
        }
      }

      setIsFormOpen(false);
      onSaveWithSync(
        {
          ...data,
          orders: [newOrder, ...data.orders],
          tasks: nextTasks,
        },
        {
          title: 'บันทึกใบออเดอร์ใหม่',
          description: `เพิ่มออเดอร์ ${newOrder.orderNo} ของคุณ ${newOrder.customerName} และสำรองข้อมูลลง Google Sheet ทันที`,
          successMessage: `บันทึกออเดอร์ ${newOrder.orderNo} แล้ว`,
        }
      );
    }
  };

  const handleDeleteOrder = (order: Order) => {
    const nextOrders = data.orders.filter((o) => o.id !== order.id);
    const nextTasks = data.tasks.filter((t) => t.orderId !== order.id);
    const nextLots = data.shippingLots.filter((l) => l.orderId !== order.id);
    if (selectedOrderDetailId === order.id) setSelectedOrderDetailId(null);

    onSaveWithSync(
      {
        ...data,
        orders: nextOrders,
        tasks: nextTasks,
        shippingLots: nextLots,
      },
      {
        title: 'ยืนยันการลบออเดอร์',
        description: `ต้องการลบออเดอร์ ${order.orderNo} (${order.customerName}) รวมถึงงานที่ต้องทำและล็อตที่เกี่ยวข้องออกจากระบบและ Google Sheet ใช่หรือไม่?`,
        confirmLabel: 'ลบและอัปเดต Google Sheet',
        successMessage: `ลบออเดอร์ ${order.orderNo} เรียบร้อย`,
        isDestructive: true,
      }
    );
  };

  const detailOrder = useMemo(
    () => data.orders.find((o) => o.id === selectedOrderDetailId) || null,
    [data.orders, selectedOrderDetailId]
  );

  return (
    <div className="space-y-6">
      {/* Mini Revenue Dashboard inside Orders Page */}
      <div className="rounded-xl border border-[#EDDCD9] bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#3B2D30]">
              สรุปยอดเงินรายเดือนและรายปี (จากล็อตการส่งของไม่รวมค่าส่ง)
            </h2>
            <p className="mt-0.5 text-xs text-[#7A6368]">
              เลือกเดือนและปีเพื่อดูสรุปยอดเงินของออเดอร์ที่จัดส่งแล้ว
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 text-[#C96A7E]" />
            <select
              aria-label="เลือกปีสรุปยอด"
              value={summaryYear}
              onChange={(e) => setSummaryYear(Number(e.target.value))}
              className="rounded-lg border border-[#E7D4D7] bg-white px-2.5 py-1.5 text-xs font-medium text-[#3B2D30] focus:border-[#C96A7E] focus:outline-none"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  ปี {yr + 543}
                </option>
              ))}
            </select>
            <select
              aria-label="เลือกเดือนสรุปยอด"
              value={summaryMonth}
              onChange={(e) =>
                setSummaryMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="rounded-lg border border-[#E7D4D7] bg-white px-2.5 py-1.5 text-xs font-medium text-[#3B2D30] focus:border-[#C96A7E] focus:outline-none"
            >
              <option value="all">ทุกเดือน</option>
              {THAI_MONTHS_FULL.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-[#F7ECE9] pt-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[#7A6368]">
              ยอดเงิน{summaryMonth === 'all' ? 'รวมทั้งปี' : `เดือน${THAI_MONTHS_FULL[summaryMonth - 1]}`} (ไม่รวมค่าส่ง)
            </p>
            <p className="font-mono-num mt-1 text-2xl font-semibold text-[#3E7255]">
              {formatBaht(monthlyRevenueExcl)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#7A6368]">
              ยอดเงินรวมทั้งปี {summaryYear + 543} (ไม่รวมค่าส่ง)
            </p>
            <p className="font-mono-num mt-1 text-2xl font-semibold text-[#B5566A]">
              {formatBaht(yearlyRevenueExcl)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#7A6368]">มูลค่ารวมใบออเดอร์ที่เปิดอยู่ทั้งหมด</p>
            <p className="font-mono-num mt-1 text-2xl font-semibold text-[#3B2D30]">
              {formatBaht(
                data.orders.reduce(
                  (sum, ord) => sum + getOrderMetrics(ord, data).totalAmountExclShipping,
                  0
                )
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#987E83]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเลข Order หรือชื่อลูกค้า..."
              className="min-h-[40px] w-full rounded-lg border border-[#E7D4D7] bg-white py-2 pr-3 pl-9 text-sm text-[#3B2D30] placeholder-[#A88F94] focus:border-[#C96A7E] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F5EAE8] p-1">
            {(['ทั้งหมด', ...ORDER_STATUS_OPTIONS] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white text-[#B5566A] shadow-xs'
                    : 'text-[#6A5559] hover:text-[#3B2D30]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#C96A7E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B5566A] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>เพิ่มใบออเดอร์ใหม่</span>
        </button>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E7D4D7] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#5A4448]">ไม่พบใบออเดอร์ที่ตรงกับเงื่อนไข</p>
          <p className="mt-1 text-xs text-[#8A7075]">
            กดปุ่ม "เพิ่มใบออเดอร์ใหม่" เพื่อเริ่มรับออเดอร์งานถักดอกไม้ไหมพรม
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[#EDDCD9] bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EDDCD9] bg-[#FCF5EE] text-xs font-medium text-[#7A6368]">
                    <th className="py-3 pr-3 pl-5">เลขออเดอร์ / ลูกค้า</th>
                    <th className="py-3 px-3">วันที่สั่งงาน</th>
                    <th className="py-3 px-3">งานที่สั่ง</th>
                    <th className="py-3 px-3">ความคืบหน้า</th>
                    <th className="py-3 px-3">การส่งแต่ละล็อต</th>
                    <th className="py-3 px-3">ส่งล่าสุด</th>
                    <th className="py-3 px-3 text-right">ยอดเงิน (ไม่รวมส่ง)</th>
                    <th className="py-3 px-3">สถานะ</th>
                    <th className="py-3 pr-5 pl-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F7ECE9]">
                  {filteredOrders.map((order) => {
                    const m = getOrderMetrics(order, data);
                    return (
                      <tr key={order.id} className="transition-colors hover:bg-[#FCF5EE]">
                        <td className="py-3.5 pr-3 pl-5">
                          <div className="font-mono-num text-xs font-semibold text-[#B5566A]">
                            {order.orderNo}
                          </div>
                          <div className="mt-0.5 font-medium text-[#3B2D30]">
                            {order.customerName}
                          </div>
                        </td>
                        <td className="font-mono-num py-3.5 px-3 text-xs text-[#6A5559] whitespace-nowrap">
                          {formatThaiDate(order.orderDate)}
                        </td>
                        <td className="max-w-[210px] py-3.5 px-3">
                          <p className="truncate text-xs text-[#3B2D30]" title={m.orderedItemsText}>
                            {m.orderedItemsText}
                          </p>
                          <p className="font-mono-num mt-0.5 text-[11px] text-[#7A6368]">
                            รวม {formatNumber(m.totalOrderedQty)} ชิ้น (ส่งแล้ว {formatNumber(m.totalShippedQty)})
                          </p>
                        </td>
                        <td className="w-36 py-3.5 px-3">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono-num font-semibold text-[#3E7255]">
                              {m.progressPercent}%
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F5EAE8]">
                            <div
                              className="h-full rounded-full bg-[#4E8767] transition-all duration-300"
                              style={{ width: `${m.progressPercent}%` }}
                            />
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          {m.lotBreakdown.length === 0 ? (
                            <span className="text-xs text-[#A88F94]">ยังไม่ส่ง</span>
                          ) : (
                            <div className="space-y-0.5 text-xs text-[#5A4448]">
                              {m.lotBreakdown.map((lb) => (
                                <div key={lb.lotNumber} className="font-mono-num whitespace-nowrap">
                                  Lot {lb.lotNumber}: {lb.qty} ชิ้น
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="font-mono-num py-3.5 px-3 text-xs text-[#6A5559] whitespace-nowrap">
                          {formatThaiDate(m.latestShipDate)}
                        </td>
                        <td className="font-mono-num py-3.5 px-3 text-right font-semibold text-[#3B2D30] whitespace-nowrap">
                          {formatBaht(m.totalAmountExclShipping)}
                        </td>
                        <td className="py-3.5 px-3">
                          <StatusLabel status={order.status} />
                        </td>
                        <td className="py-3.5 pr-5 pl-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedOrderDetailId(order.id)}
                              title="ดูรายละเอียด"
                              className="rounded-lg p-1.5 text-[#6A5559] hover:bg-[#FCECEF] hover:text-[#B5566A]"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onQuickLogShipping(order.id)}
                              title="บันทึกล็อตส่งของ"
                              className="rounded-lg p-1.5 text-[#3E7255] hover:bg-[#E8F3EC]"
                            >
                              <Truck className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(order)}
                              title="แก้ไข"
                              className="rounded-lg p-1.5 text-[#6A5559] hover:bg-[#FCECEF] hover:text-[#B5566A]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(order)}
                              title="ลบ"
                              className="rounded-lg p-1.5 text-[#B91C1C]/70 hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 lg:hidden">
            {filteredOrders.map((order) => {
              const m = getOrderMetrics(order, data);
              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-[#EDDCD9] bg-white p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#7A6368]">
                        <span className="font-mono-num font-semibold text-[#B5566A]">
                          {order.orderNo}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{formatThaiDate(order.orderDate)}</span>
                      </div>
                      <h3 className="mt-1 text-base font-semibold text-[#3B2D30]">
                        {order.customerName}
                      </h3>
                    </div>
                    <StatusLabel status={order.status} />
                  </div>

                  <p className="text-xs text-[#5A4448]">{m.orderedItemsText}</p>

                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#7A6368]">
                        ความคืบหน้า ({m.totalShippedQty}/{m.totalOrderedQty} ชิ้น)
                      </span>
                      <span className="font-mono-num font-semibold text-[#3E7255]">
                        {m.progressPercent}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#F5EAE8]">
                      <div
                        className="h-full rounded-full bg-[#4E8767]"
                        style={{ width: `${m.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F7ECE9] pt-3 text-xs">
                    <div>
                      <span className="text-[#7A6368]">ยอดเงินไม่รวมส่ง: </span>
                      <span className="font-mono-num font-semibold text-[#3B2D30]">
                        {formatBaht(m.totalAmountExclShipping)}
                      </span>
                    </div>
                    <div className="text-[#7A6368]">
                      ส่งล่าสุด: <span className="font-mono-num">{formatThaiDate(m.latestShipDate)}</span>
                    </div>
                  </div>

                  {m.lotBreakdown.length > 0 && (
                    <div className="text-xs text-[#6A5559]">
                      {m.lotBreakdown
                        .map((lb) => `Lot ${lb.lotNumber}: ส่ง ${lb.qty} ชิ้น`)
                        .join(' · ')}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedOrderDetailId(order.id)}
                      className="min-h-[38px] rounded-lg border border-[#E7D4D7] px-3 py-1.5 text-xs font-medium text-[#3B2D30]"
                    >
                      รายละเอียด
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickLogShipping(order.id)}
                      className="min-h-[38px] rounded-lg bg-[#E8F3EC] px-3 py-1.5 text-xs font-medium text-[#3E7255]"
                    >
                      ส่งล็อต
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(order)}
                      className="min-h-[38px] rounded-lg border border-[#E7D4D7] px-3 py-1.5 text-xs font-medium text-[#6A5559]"
                    >
                      แก้ไข
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Order Detail Modal */}
      {detailOrder && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#3B2D30]/40 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#EBD8D4] bg-white p-6 shadow-lg">
            {(() => {
              const m = getOrderMetrics(detailOrder, data);
              return (
                <>
                  <div className="flex items-start justify-between gap-4 border-b border-[#F5EAE8] pb-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#7A6368]">
                        <span className="font-mono-num font-semibold text-[#B5566A]">
                          {detailOrder.orderNo}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">
                          สั่งวันที่ {formatThaiDate(detailOrder.orderDate)}
                        </span>
                      </div>
                      <h3 className="mt-1 text-lg font-semibold text-[#3B2D30]">
                        {detailOrder.customerName}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOrderDetailId(null)}
                      className="rounded-lg p-1.5 text-[#7A6368] hover:bg-[#FAF1EC]"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-[#7A6368]">สถานะงาน</p>
                      <div className="mt-1">
                        <StatusLabel status={detailOrder.status} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-[#7A6368]">ความคืบหน้า</p>
                      <p className="font-mono-num mt-1 text-base font-semibold text-[#3E7255]">
                        {m.progressPercent}% ({m.totalShippedQty}/{m.totalOrderedQty})
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#7A6368]">ยอดเงินไม่รวมค่าส่ง</p>
                      <p className="font-mono-num mt-1 text-base font-semibold text-[#B5566A]">
                        {formatBaht(m.totalAmountExclShipping)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#7A6368]">ส่งงานล่าสุด</p>
                      <p className="font-mono-num mt-1 text-sm font-medium text-[#3B2D30]">
                        {formatThaiDate(m.latestShipDate)}
                      </p>
                    </div>
                  </div>

                  {detailOrder.notes && (
                    <p className="mt-4 rounded-lg bg-[#FCF5EE] px-3.5 py-2.5 text-xs text-[#5A4448]">
                      หมายเหตุ: {detailOrder.notes}
                    </p>
                  )}

                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-[#3B2D30]">
                      รายการงานที่สั่ง ({m.tasks.length} รายการ)
                    </h4>
                    <div className="mt-2 divide-y divide-[#F7ECE9] rounded-lg border border-[#F5EAE8]">
                      {m.tasks.length === 0 ? (
                        <p className="p-4 text-xs text-[#8A7075]">
                          ยังไม่มีรายการงานในออเดอร์นี้
                        </p>
                      ) : (
                        m.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between gap-3 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <ProductImage
                                src={task.sampleImageUrl}
                                alt={task.itemName}
                                className="h-10 w-10"
                              />
                              <div>
                                <p className="text-sm font-medium text-[#3B2D30]">
                                  {task.itemName}
                                </p>
                                <p className="text-xs text-[#7A6368]">
                                  {task.category} · {formatBaht(task.unitPrice)}/ชิ้น
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-mono-num text-sm font-semibold text-[#3B2D30]">
                                {task.quantityOrdered} ชิ้น
                              </p>
                              <StatusLabel status={task.status} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-[#3B2D30]">
                        ประวัติการส่งแต่ละล็อต ({m.lots.length} ล็อต)
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          const id = detailOrder.id;
                          setSelectedOrderDetailId(null);
                          onQuickLogShipping(id);
                        }}
                        className="text-xs font-medium text-[#3E7255] hover:underline"
                      >
                        + บันทึกล็อตใหม่
                      </button>
                    </div>
                    <div className="mt-2 divide-y divide-[#F7ECE9] rounded-lg border border-[#F5EAE8]">
                      {m.lots.length === 0 ? (
                        <p className="p-4 text-xs text-[#8A7075]">
                          ยังไม่มีการบันทึกล็อตจัดส่งสำหรับออเดอร์นี้
                        </p>
                      ) : (
                        m.lots.map((lot) => (
                          <div
                            key={lot.id}
                            className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
                          >
                            <div>
                              <span className="font-mono-num font-semibold text-[#B5566A]">
                                Lot {lot.lotNumber}
                              </span>
                              <span className="mx-1.5 text-[#A88F94]">·</span>
                              <span className="font-medium text-[#3B2D30]">{lot.itemName}</span>
                              <span className="mx-1.5 text-[#A88F94]">·</span>
                              <span className="font-mono-num text-[#7A6368]">
                                {formatThaiDate(lot.shipDate)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-mono-num font-semibold text-[#3B2D30]">
                                {lot.quantityShipped} ชิ้น ({formatBaht(lot.totalAmount)})
                              </span>
                              <StatusLabel status={lot.status} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Create / Edit Order Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#3B2D30]/40 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmit}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#EBD8D4] bg-white p-6 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-[#F5EAE8] pb-3">
              <h3 className="text-base font-semibold text-[#3B2D30]">
                {editingOrder ? `แก้ไขใบออเดอร์ ${editingOrder.orderNo}` : 'เพิ่มใบออเดอร์ใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg p-1.5 text-[#7A6368] hover:bg-[#FAF1EC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    หมายเลข Order *
                  </label>
                  <input
                    type="text"
                    required
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    className="font-mono-num mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    วันที่สั่งงาน *
                  </label>
                  <input
                    type="date"
                    required
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="font-mono-num mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5A4448]">
                  ชื่อลูกค้า *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="เช่น คุณพิมพ์ชนก"
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5A4448]">
                  สถานะของงาน
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] bg-white px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                >
                  {ORDER_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {!editingOrder && data.products.length > 0 && (
                <div className="rounded-lg border border-[#F5EAE8] bg-[#FCF5EE] p-3.5">
                  <p className="text-xs font-medium text-[#3B2D30]">
                    เพิ่มรายการงานแรกทันที (ไม่บังคับ)
                  </p>
                  <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <select
                        aria-label="เลือกสินค้า"
                        value={initialProductId}
                        onChange={(e) => setInitialProductId(e.target.value)}
                        className="min-h-[38px] w-full rounded-lg border border-[#E7D4D7] bg-white px-2.5 py-1.5 text-xs focus:border-[#C96A7E] focus:outline-none"
                      >
                        <option value="">— ยังไม่เพิ่มรายการตอนนี้ —</option>
                        {data.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatBaht(p.price)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        min={1}
                        value={initialQty}
                        onChange={(e) => setInitialQty(Math.max(1, Number(e.target.value)))}
                        disabled={!initialProductId}
                        placeholder="จำนวน"
                        className="font-mono-num min-h-[38px] w-full rounded-lg border border-[#E7D4D7] bg-white px-2.5 py-1.5 text-xs focus:border-[#C96A7E] focus:outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#5A4448]">
                  รายละเอียด / หมายเหตุเพิ่มเติม
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="โทนสีไหมพรม การห่อช่อ หรือข้อความแนบการ์ด"
                  className="mt-1 w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#F5EAE8] pt-4">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="min-h-[40px] rounded-lg border border-[#E7D4D7] px-4 py-2 text-sm font-medium text-[#5A4448] hover:bg-[#FAF1EC]"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="min-h-[40px] rounded-lg bg-[#C96A7E] px-4 py-2 text-sm font-medium text-white hover:bg-[#B5566A]"
              >
                บันทึกออเดอร์
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
