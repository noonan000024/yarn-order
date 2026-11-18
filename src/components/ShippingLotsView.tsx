import React, { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { PRODUCT_CATEGORIES } from '../data/initialData';
import {
  AppData,
  OrderStatus,
  ShippingLot,
  ShippingStatus,
  TaskStatus,
} from '../types/studio';
import {
  THAI_MONTHS_FULL,
  filterLotsByPeriod,
  formatBaht,
  formatNumber,
  formatThaiDate,
  getAvailableYearsFromLots,
} from '../utils/calculations';
import { StatusLabel } from './ProductDisplay';

interface ShippingLotsViewProps {
  data: AppData;
  prefillRequest: { orderId: string; taskId?: string; nonce: number } | null;
  onClearPrefill: () => void;
  onSaveWithSync: (
    nextData: AppData,
    summary: {
      title: string;
      description: string;
      confirmLabel?: string;
      successMessage: string;
      isDestructive?: boolean;
    }
  ) => void;
}

const SHIPPING_STATUS_OPTIONS: ShippingStatus[] = [
  'เตรียมส่ง',
  'กำลังจัดส่ง',
  'ส่งสำเร็จแล้ว',
];

export const ShippingLotsView: React.FC<ShippingLotsViewProps> = ({
  data,
  prefillRequest,
  onClearPrefill,
  onSaveWithSync,
}) => {
  const now = new Date();
  const availableYears = useMemo(
    () => getAvailableYearsFromLots(data.shippingLots, data.orders),
    [data.shippingLots, data.orders]
  );

  const [filterYear, setFilterYear] = useState<number | 'all'>('all');
  const [filterMonth, setFilterMonth] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<ShippingLot | null>(null);

  const [orderId, setOrderId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [lotNumber, setLotNumber] = useState(1);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [quantityShipped, setQuantityShipped] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [shippingFee, setShippingFee] = useState(50);
  const [shipDate, setShipDate] = useState(now.toISOString().slice(0, 10));
  const [status, setStatus] = useState<ShippingStatus>('กำลังจัดส่ง');

  const getNextLotNumberForOrder = (targetOrderId: string) => {
    const existingLots = data.shippingLots.filter((l) => l.orderId === targetOrderId);
    if (existingLots.length === 0) return 1;
    return Math.max(...existingLots.map((l) => l.lotNumber)) + 1;
  };

  const applyOrderSelection = (targetOrderId: string, preferredTaskId?: string) => {
    setOrderId(targetOrderId);
    setLotNumber(getNextLotNumberForOrder(targetOrderId));
    const orderTasks = data.tasks.filter((t) => t.orderId === targetOrderId);
    const matchedTask = preferredTaskId
      ? orderTasks.find((t) => t.id === preferredTaskId)
      : orderTasks[0];

    if (matchedTask) {
      setTaskId(matchedTask.id);
      setItemName(matchedTask.itemName);
      setCategory(matchedTask.category);
      setUnitPrice(matchedTask.unitPrice);
      const alreadyShipped = data.shippingLots
        .filter((l) => l.taskId === matchedTask.id)
        .reduce((sum, l) => sum + Number(l.quantityShipped || 0), 0);
      const remaining = Math.max(1, matchedTask.quantityOrdered - alreadyShipped);
      setQuantityShipped(remaining);
    } else {
      setTaskId('');
      setItemName('');
      setUnitPrice(0);
      setQuantityShipped(1);
    }
  };

  useEffect(() => {
    if (prefillRequest) {
      setEditingLot(null);
      setShippingFee(50);
      setShipDate(new Date().toISOString().slice(0, 10));
      setStatus('กำลังจัดส่ง');
      applyOrderSelection(prefillRequest.orderId, prefillRequest.taskId);
      setIsFormOpen(true);
      onClearPrefill();
    }
  }, [prefillRequest]);

  const openCreateModal = () => {
    setEditingLot(null);
    const defaultOrderId = data.orders[0]?.id || '';
    setShippingFee(50);
    setShipDate(new Date().toISOString().slice(0, 10));
    setStatus('กำลังจัดส่ง');
    applyOrderSelection(defaultOrderId);
    setIsFormOpen(true);
  };

  const openEditModal = (lot: ShippingLot) => {
    setEditingLot(lot);
    setOrderId(lot.orderId);
    setTaskId(lot.taskId || '');
    setLotNumber(lot.lotNumber);
    setItemName(lot.itemName);
    setCategory(lot.category);
    setQuantityShipped(lot.quantityShipped);
    setUnitPrice(lot.unitPrice);
    setShippingFee(lot.shippingFee);
    setShipDate(lot.shipDate);
    setStatus(lot.status);
    setIsFormOpen(true);
  };

  const handleTaskSelect = (selectedTaskId: string) => {
    setTaskId(selectedTaskId);
    const task = data.tasks.find((t) => t.id === selectedTaskId);
    if (task) {
      setItemName(task.itemName);
      setCategory(task.category);
      setUnitPrice(task.unitPrice);
      const alreadyShipped = data.shippingLots
        .filter((l) => l.taskId === task.id && l.id !== editingLot?.id)
        .reduce((sum, l) => sum + Number(l.quantityShipped || 0), 0);
      setQuantityShipped(Math.max(1, task.quantityOrdered - alreadyShipped));
    }
  };

  const computedTotal =
    Math.max(0, Number(quantityShipped) || 0) * Math.max(0, Number(unitPrice) || 0) +
    Math.max(0, Number(shippingFee) || 0);

  const reconcileStatuses = (baseData: AppData, affectedOrderId: string): AppData => {
    const updatedTasks = baseData.tasks.map((task) => {
      if (task.orderId !== affectedOrderId) return task;
      const shipped = baseData.shippingLots
        .filter(
          (l) =>
            l.taskId === task.id ||
            (l.orderId === task.orderId && l.itemName === task.itemName && !l.taskId)
        )
        .reduce((sum, l) => sum + Number(l.quantityShipped || 0), 0);

      let nextStatus: TaskStatus = task.status;
      if (shipped >= task.quantityOrdered && task.quantityOrdered > 0) {
        nextStatus = 'ส่งครบแล้ว';
      } else if (shipped > 0) {
        nextStatus = 'ส่งบางส่วน';
      }
      return { ...task, status: nextStatus };
    });

    const orderTasks = updatedTasks.filter((t) => t.orderId === affectedOrderId);
    const totalOrdered = orderTasks.reduce((s, t) => s + Number(t.quantityOrdered || 0), 0);
    const totalShipped = baseData.shippingLots
      .filter((l) => l.orderId === affectedOrderId)
      .reduce((s, l) => s + Number(l.quantityShipped || 0), 0);

    const updatedOrders = baseData.orders.map((ord) => {
      if (ord.id !== affectedOrderId) return ord;
      let nextOrderStatus: OrderStatus = ord.status;
      if (totalOrdered > 0 && totalShipped >= totalOrdered) {
        nextOrderStatus = 'ส่งครบแล้ว';
      } else if (totalShipped > 0) {
        nextOrderStatus = 'ส่งบางส่วน';
      }
      return { ...ord, status: nextOrderStatus };
    });

    return {
      ...baseData,
      tasks: updatedTasks,
      orders: updatedOrders,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const order = data.orders.find((o) => o.id === orderId);
    if (!order || !itemName.trim()) return;

    const qty = Math.max(1, Number(quantityShipped) || 1);
    const price = Math.max(0, Number(unitPrice) || 0);
    const fee = Math.max(0, Number(shippingFee) || 0);
    const totalAmount = qty * price + fee;

    if (editingLot) {
      const nextLots = data.shippingLots.map((l) =>
        l.id === editingLot.id
          ? {
              ...l,
              orderId: order.id,
              orderNo: order.orderNo,
              customerName: order.customerName,
              lotNumber: Math.max(1, Number(lotNumber) || 1),
              taskId: taskId || undefined,
              itemName: itemName.trim(),
              category,
              quantityShipped: qty,
              unitPrice: price,
              shippingFee: fee,
              shipDate,
              status,
              totalAmount,
            }
          : l
      );
      const reconciled = reconcileStatuses({ ...data, shippingLots: nextLots }, order.id);
      setIsFormOpen(false);
      onSaveWithSync(reconciled, {
        title: 'บันทึกการแก้ไขล็อตจัดส่ง',
        description: `อัปเดต Lot ${lotNumber} ของออเดอร์ ${order.orderNo} (${formatBaht(totalAmount)}) และสำรองลง Google Sheet ทันที`,
        successMessage: `อัปเดต Lot ${lotNumber} เรียบร้อย`,
      });
    } else {
      const newLot: ShippingLot = {
        id: `lot-${Date.now()}`,
        orderId: order.id,
        orderNo: order.orderNo,
        customerName: order.customerName,
        lotNumber: Math.max(1, Number(lotNumber) || 1),
        taskId: taskId || undefined,
        itemName: itemName.trim(),
        category,
        quantityShipped: qty,
        unitPrice: price,
        shippingFee: fee,
        shipDate,
        status,
        totalAmount,
      };
      const reconciled = reconcileStatuses(
        { ...data, shippingLots: [newLot, ...data.shippingLots] },
        order.id
      );
      setIsFormOpen(false);
      onSaveWithSync(reconciled, {
        title: 'บันทึกล็อตการจัดส่งงาน',
        description: `บันทึก Lot ${newLot.lotNumber} (${newLot.itemName} × ${newLot.quantityShipped} ชิ้น, รวม ${formatBaht(totalAmount)}) พร้อมอัปเดตความคืบหน้าออเดอร์ ${order.orderNo} ลง Google Sheet ทันที`,
        successMessage: `บันทึก Lot ${newLot.lotNumber} ของ ${order.orderNo} แล้ว`,
      });
    }
  };

  const handleDeleteLot = (lot: ShippingLot) => {
    const nextLots = data.shippingLots.filter((l) => l.id !== lot.id);
    const reconciled = reconcileStatuses({ ...data, shippingLots: nextLots }, lot.orderId);
    onSaveWithSync(reconciled, {
      title: 'ยืนยันการลบล็อตจัดส่ง',
      description: `ต้องการลบ Lot ${lot.lotNumber} ของออเดอร์ ${lot.orderNo} (${lot.itemName}) ออกจากระบบและ Google Sheet ใช่หรือไม่?`,
      confirmLabel: 'ลบและอัปเดต Google Sheet',
      successMessage: `ลบ Lot ${lot.lotNumber} เรียบร้อย`,
      isDestructive: true,
    });
  };

  const filteredLots = useMemo(() => {
    return filterLotsByPeriod(data.shippingLots, filterYear, filterMonth)
      .filter((lot) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          lot.orderNo.toLowerCase().includes(q) ||
          lot.customerName.toLowerCase().includes(q) ||
          lot.itemName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.shipDate.localeCompare(a.shipDate) || b.lotNumber - a.lotNumber);
  }, [data.shippingLots, filterYear, filterMonth, searchQuery]);

  const summary = useMemo(() => {
    const units = filteredLots.reduce((s, l) => s + Number(l.quantityShipped || 0), 0);
    const prodSales = filteredLots.reduce(
      (s, l) => s + Number(l.quantityShipped || 0) * Number(l.unitPrice || 0),
      0
    );
    const fees = filteredLots.reduce((s, l) => s + Number(l.shippingFee || 0), 0);
    return {
      lotCount: filteredLots.length,
      units,
      prodSales,
      fees,
      grandTotal: prodSales + fees,
    };
  }, [filteredLots]);

  const selectedOrderTasks = useMemo(
    () => data.tasks.filter((t) => t.orderId === orderId),
    [data.tasks, orderId]
  );

  const selectedOrderCustomer = useMemo(
    () => data.orders.find((o) => o.id === orderId)?.customerName || '',
    [data.orders, orderId]
  );

  return (
    <div className="space-y-6">
      {/* Period Summary Bar */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-[#EDDCD9] bg-white p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-[#7A6368]">จำนวนล็อตที่แสดง</p>
          <p className="font-mono-num mt-1 text-xl font-semibold text-[#3B2D30]">
            {formatNumber(summary.lotCount)} ล็อต
          </p>
        </div>
        <div>
          <p className="text-xs text-[#7A6368]">จำนวนชิ้นงานที่ส่ง</p>
          <p className="font-mono-num mt-1 text-xl font-semibold text-[#3B2D30]">
            {formatNumber(summary.units)} ชิ้น
          </p>
        </div>
        <div>
          <p className="text-xs text-[#7A6368]">ยอดขายสินค้า (ไม่รวมค่าส่ง)</p>
          <p className="font-mono-num mt-1 text-xl font-semibold text-[#3E7255]">
            {formatBaht(summary.prodSales)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#7A6368]">รวมเป็นเงิน (รวมค่าส่ง)</p>
          <p className="font-mono-num mt-1 text-xl font-semibold text-[#B5566A]">
            {formatBaht(summary.grandTotal)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#987E83]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเลข Order, ชื่อลูกค้า, ชื่องาน..."
              className="min-h-[40px] w-full rounded-lg border border-[#E7D4D7] bg-white py-2 pr-3 pl-9 text-sm text-[#3B2D30] placeholder-[#A88F94] focus:border-[#C96A7E] focus:outline-none"
            />
          </div>

          <select
            aria-label="กรองตามปี"
            value={filterYear}
            onChange={(e) =>
              setFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="min-h-[40px] rounded-lg border border-[#E7D4D7] bg-white px-3 py-2 text-xs font-medium text-[#3B2D30] focus:border-[#C96A7E] focus:outline-none"
          >
            <option value="all">ทุกปี</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                ปี {yr + 543}
              </option>
            ))}
          </select>

          <select
            aria-label="กรองตามเดือน"
            value={filterMonth}
            onChange={(e) =>
              setFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="min-h-[40px] rounded-lg border border-[#E7D4D7] bg-white px-3 py-2 text-xs font-medium text-[#3B2D30] focus:border-[#C96A7E] focus:outline-none"
          >
            <option value="all">ทุกเดือน</option>
            {THAI_MONTHS_FULL.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          disabled={data.orders.length === 0}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#C96A7E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B5566A] disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>บันทึกล็อตการส่ง</span>
        </button>
      </div>

      {/* Lots Table / Mobile Cards */}
      {filteredLots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E7D4D7] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#5A4448]">ยังไม่มีข้อมูลล็อตการจัดส่ง</p>
          <p className="mt-1 text-xs text-[#8A7075]">
            กด "บันทึกล็อตการส่ง" เพื่ออัปเดตจำนวนที่ส่งและสรุปยอดขายเข้าแดชบอร์ด
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[#EDDCD9] bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EDDCD9] bg-[#FCF5EE] text-xs font-medium text-[#7A6368]">
                    <th className="py-3 pr-3 pl-5">วันที่ส่ง</th>
                    <th className="py-3 px-3">หมายเลข Order / ลูกค้า</th>
                    <th className="py-3 px-3">Lot</th>
                    <th className="py-3 px-3">งานที่ต้องทำ / ประเภท</th>
                    <th className="py-3 px-3 text-right">จำนวนที่ส่ง</th>
                    <th className="py-3 px-3 text-right">ราคา/ชิ้น</th>
                    <th className="py-3 px-3 text-right">ค่าส่ง</th>
                    <th className="py-3 px-3 text-right">รวมเป็นเงิน</th>
                    <th className="py-3 px-3">สถานะ</th>
                    <th className="py-3 pr-5 pl-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F7ECE9]">
                  {filteredLots.map((lot) => (
                    <tr key={lot.id} className="transition-colors hover:bg-[#FCF5EE]">
                      <td className="font-mono-num py-3.5 pr-3 pl-5 text-xs text-[#6A5559] whitespace-nowrap">
                        {formatThaiDate(lot.shipDate)}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-mono-num text-xs font-semibold text-[#B5566A]">
                          {lot.orderNo}
                        </div>
                        <div className="text-xs text-[#3B2D30]">{lot.customerName}</div>
                      </td>
                      <td className="font-mono-num py-3.5 px-3 text-xs font-semibold text-[#3B2D30] whitespace-nowrap">
                        Lot {lot.lotNumber}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-[#3B2D30]">{lot.itemName}</div>
                        <div className="text-xs text-[#7A6368]">{lot.category}</div>
                      </td>
                      <td className="font-mono-num py-3.5 px-3 text-right font-medium text-[#3B2D30]">
                        {formatNumber(lot.quantityShipped)}
                      </td>
                      <td className="font-mono-num py-3.5 px-3 text-right text-xs text-[#6A5559]">
                        {formatBaht(lot.unitPrice)}
                      </td>
                      <td className="font-mono-num py-3.5 px-3 text-right text-xs text-[#6A5559]">
                        {formatBaht(lot.shippingFee)}
                      </td>
                      <td className="font-mono-num py-3.5 px-3 text-right font-semibold text-[#3E7255]">
                        {formatBaht(lot.totalAmount)}
                      </td>
                      <td className="py-3.5 px-3">
                        <StatusLabel status={lot.status} />
                      </td>
                      <td className="py-3.5 pr-5 pl-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(lot)}
                            title="แก้ไข"
                            className="rounded-lg p-1.5 text-[#6A5559] hover:bg-[#FCECEF] hover:text-[#B5566A]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLot(lot)}
                            title="ลบ"
                            className="rounded-lg p-1.5 text-[#B91C1C]/70 hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 lg:hidden">
            {filteredLots.map((lot) => (
              <div
                key={lot.id}
                className="rounded-xl border border-[#EDDCD9] bg-white p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#7A6368]">
                      <span className="font-mono-num font-semibold text-[#B5566A]">
                        {lot.orderNo} · Lot {lot.lotNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{formatThaiDate(lot.shipDate)}</span>
                    </div>
                    <h3 className="mt-0.5 text-sm font-semibold text-[#3B2D30]">
                      {lot.customerName}
                    </h3>
                  </div>
                  <StatusLabel status={lot.status} />
                </div>

                <div className="text-xs text-[#5A4448]">
                  <span className="font-medium text-[#3B2D30]">{lot.itemName}</span>
                  <span> · {lot.category}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F7ECE9] pt-3 text-xs">
                  <div className="font-mono-num text-[#6A5559]">
                    {lot.quantityShipped} ชิ้น × {formatBaht(lot.unitPrice)} + ค่าส่ง{' '}
                    {formatBaht(lot.shippingFee)}
                  </div>
                  <div className="font-mono-num text-sm font-semibold text-[#3E7255]">
                    รวม {formatBaht(lot.totalAmount)}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(lot)}
                    className="min-h-[38px] rounded-lg border border-[#E7D4D7] px-3 py-1.5 text-xs font-medium text-[#6A5559]"
                  >
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLot(lot)}
                    className="min-h-[38px] rounded-lg border border-[#E7D4D7] px-3 py-1.5 text-xs font-medium text-[#B91C1C]"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create / Edit Shipping Lot Modal */}
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
                {editingLot
                  ? `แก้ไขล็อตส่งงาน (${editingLot.orderNo} · Lot ${editingLot.lotNumber})`
                  : 'บันทึกล็อตการจัดส่งงาน'}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#5A4448]">
                    หมายเลข Order *
                  </label>
                  <select
                    required
                    value={orderId}
                    onChange={(e) => applyOrderSelection(e.target.value)}
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] bg-white px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  >
                    {data.orders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.orderNo} — {ord.customerName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    หมายเลข Lot ที่ *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={lotNumber}
                    onChange={(e) => setLotNumber(Number(e.target.value))}
                    className="font-mono-num mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-[#FCF5EE] px-3.5 py-2.5 text-xs text-[#5A4448]">
                ชื่อลูกค้า: <span className="font-semibold text-[#3B2D30]">{selectedOrderCustomer || '—'}</span>
              </div>

              {selectedOrderTasks.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#B5566A]">
                    เลือกจากงานที่ต้องทำในออเดอร์นี้
                  </label>
                  <select
                    value={taskId}
                    onChange={(e) => handleTaskSelect(e.target.value)}
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] bg-white px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  >
                    <option value="">— กรอกชื่อรายการเองด้านล่าง —</option>
                    {selectedOrderTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.itemName} (สั่ง {t.quantityOrdered} ชิ้น · {formatBaht(t.unitPrice)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    งานที่ต้องทำ / รายการที่ส่ง *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    ประเภทของงาน *
                  </label>
                  <input
                    type="text"
                    list="lot-category-list"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                  <datalist id="lot-category-list">
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    จำนวนที่ส่ง *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantityShipped}
                    onChange={(e) => setQuantityShipped(Number(e.target.value))}
                    className="font-mono-num mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    ราคาต่อชิ้นงาน (บาท) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="font-mono-num mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    ค่าส่ง (บาท)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={shippingFee}
                    onChange={(e) => setShippingFee(Number(e.target.value))}
                    className="font-mono-num mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    วันที่ส่ง *
                  </label>
                  <input
                    type="date"
                    required
                    value={shipDate}
                    onChange={(e) => setShipDate(e.target.value)}
                    className="font-mono-num mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    สถานะของงาน
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ShippingStatus)}
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] bg-white px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  >
                    {SHIPPING_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#B8DBC4] bg-[#E8F3EC] px-4 py-3">
                <span className="text-xs font-medium text-[#3E7255]">รวมเป็นเงินสุทธิ (ค่าสินค้า + ค่าส่ง)</span>
                <span className="font-mono-num text-lg font-semibold text-[#3E7255]">
                  {formatBaht(computedTotal)}
                </span>
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
                บันทึกล็อตจัดส่ง
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
