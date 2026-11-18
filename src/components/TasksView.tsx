import React, { useMemo, useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import { PRESET_IMAGES, PRODUCT_CATEGORIES } from '../data/initialData';
import { AppData, TaskItem, TaskStatus } from '../types/studio';
import {
  formatBaht,
  formatNumber,
  getLatestLotInfoForTask,
} from '../utils/calculations';
import { resizeImageToDataUrl } from '../utils/imageUtils';
import { ProductImage, StatusLabel } from './ProductDisplay';

interface TasksViewProps {
  data: AppData;
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
  onQuickLogShipping: (orderId: string, taskId: string) => void;
}

const TASK_STATUS_OPTIONS: TaskStatus[] = [
  'รอถัก',
  'กำลังถัก',
  'พร้อมส่ง',
  'ส่งบางส่วน',
  'ส่งครบแล้ว',
];

export const TasksView: React.FC<TasksViewProps> = ({
  data,
  onSaveWithSync,
  onQuickLogShipping,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ทั้งหมด'>('ทั้งหมด');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const [orderId, setOrderId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [quantityOrdered, setQuantityOrdered] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [status, setStatus] = useState<TaskStatus>('รอถัก');
  const [sampleImageUrl, setSampleImageUrl] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredTasks = useMemo(() => {
    return data.tasks.filter((task) => {
      if (statusFilter !== 'ทั้งหมด' && task.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const order = data.orders.find((o) => o.id === task.orderId);
        const match =
          task.orderNo.toLowerCase().includes(q) ||
          task.itemName.toLowerCase().includes(q) ||
          task.category.toLowerCase().includes(q) ||
          (order?.customerName.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }
      return true;
    });
  }, [data.tasks, data.orders, searchQuery, statusFilter]);

  const openCreateModal = () => {
    setEditingTask(null);
    const defaultOrder = data.orders[0];
    const defaultProduct = data.products[0];
    setOrderId(defaultOrder?.id || '');
    setSelectedProductId(defaultProduct?.id || '');
    setItemName(defaultProduct?.name || '');
    setCategory(defaultProduct?.category || PRODUCT_CATEGORIES[0]);
    setQuantityOrdered(1);
    setUnitPrice(defaultProduct?.price || 0);
    setStatus('รอถัก');
    setSampleImageUrl(defaultProduct?.imageUrl || '');
    setImageError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setOrderId(task.orderId);
    setSelectedProductId(task.productId || '');
    setItemName(task.itemName);
    setCategory(task.category);
    setQuantityOrdered(task.quantityOrdered);
    setUnitPrice(task.unitPrice);
    setStatus(task.status);
    setSampleImageUrl(task.sampleImageUrl || '');
    setImageError(null);
    setIsFormOpen(true);
  };

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = data.products.find((p) => p.id === prodId);
    if (prod) {
      setItemName(prod.name);
      setCategory(prod.category);
      setUnitPrice(prod.price);
      if (prod.imageUrl) {
        setSampleImageUrl(prod.imageUrl);
      }
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    try {
      const compressed = await resizeImageToDataUrl(file, 240, 0.68);
      setSampleImageUrl(compressed);
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const order = data.orders.find((o) => o.id === orderId);
    if (!order || !itemName.trim()) return;

    if (editingTask) {
      const nextTasks = data.tasks.map((t) =>
        t.id === editingTask.id
          ? {
              ...t,
              orderId: order.id,
              orderNo: order.orderNo,
              productId: selectedProductId || undefined,
              itemName: itemName.trim(),
              category,
              quantityOrdered: Math.max(1, Number(quantityOrdered) || 1),
              unitPrice: Math.max(0, Number(unitPrice) || 0),
              status,
              sampleImageUrl: sampleImageUrl.trim() || undefined,
            }
          : t
      );
      setIsFormOpen(false);
      onSaveWithSync(
        { ...data, tasks: nextTasks },
        {
          title: 'บันทึกการแก้ไขงานที่ต้องทำ',
          description: `อัปเดตรายการ "${itemName.trim()}" ของออเดอร์ ${order.orderNo} และสำรองข้อมูลลง Google Sheet ทันที`,
          successMessage: 'บันทึกงานเรียบร้อย',
        }
      );
    } else {
      const newTask: TaskItem = {
        id: `task-${Date.now()}`,
        orderId: order.id,
        orderNo: order.orderNo,
        productId: selectedProductId || undefined,
        itemName: itemName.trim(),
        category,
        quantityOrdered: Math.max(1, Number(quantityOrdered) || 1),
        unitPrice: Math.max(0, Number(unitPrice) || 0),
        status,
        sampleImageUrl: sampleImageUrl.trim() || undefined,
      };
      setIsFormOpen(false);
      onSaveWithSync(
        { ...data, tasks: [newTask, ...data.tasks] },
        {
          title: 'เพิ่มงานที่ต้องทำใหม่',
          description: `เพิ่ม "${newTask.itemName}" (${newTask.quantityOrdered} ชิ้น) ในออเดอร์ ${order.orderNo} และสำรองลง Google Sheet ทันที`,
          successMessage: 'เพิ่มรายการงานแล้ว',
        }
      );
    }
  };

  const handleDeleteTask = (task: TaskItem) => {
    const nextTasks = data.tasks.filter((t) => t.id !== task.id);
    onSaveWithSync(
      { ...data, tasks: nextTasks },
      {
        title: 'ยืนยันการลบรายการงาน',
        description: `ต้องการลบงาน "${task.itemName}" ในออเดอร์ ${task.orderNo} ออกจากระบบและ Google Sheet ใช่หรือไม่?`,
        confirmLabel: 'ลบและอัปเดต Google Sheet',
        successMessage: 'ลบรายการงานเรียบร้อย',
        isDestructive: true,
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#987E83]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาเลขออเดอร์, ชื่องาน, ประเภท..."
              className="min-h-[40px] w-full rounded-lg border border-[#E7D4D7] bg-white py-2 pr-3 pl-9 text-sm text-[#3B2D30] placeholder-[#A88F94] focus:border-[#C96A7E] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-[#F5EAE8] p-1">
            {(['ทั้งหมด', ...TASK_STATUS_OPTIONS] as const).map((st) => (
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
          disabled={data.orders.length === 0}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#C96A7E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B5566A] disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>เพิ่มงานที่ต้องทำ</span>
        </button>
      </div>

      {data.orders.length === 0 && (
        <div className="rounded-xl border border-[#EDDCD9] bg-white p-4 text-xs text-[#7A6368]">
          กรุณาสร้างใบออเดอร์ในหน้า "ใบออเดอร์" ก่อนจึงจะเพิ่มงานที่ต้องทำได้
        </div>
      )}

      {/* Task Table / Mobile Cards */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E7D4D7] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#5A4448]">ไม่พบรายการงานที่ต้องทำ</p>
          <p className="mt-1 text-xs text-[#8A7075]">
            เพิ่มงานใหม่และดึงชื่อสินค้า ประเภท และราคาจากคลังสินค้าได้ทันที
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[#EDDCD9] bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#EDDCD9] bg-[#FCF5EE] text-xs font-medium text-[#7A6368]">
                    <th className="py-3 pr-3 pl-5">ตัวอย่าง</th>
                    <th className="py-3 px-3">เลขออเดอร์ / ลูกค้า</th>
                    <th className="py-3 px-3">รายการที่สั่ง</th>
                    <th className="py-3 px-3">ประเภทของงาน</th>
                    <th className="py-3 px-3 text-right">จำนวนที่สั่ง</th>
                    <th className="py-3 px-3 text-right">ส่งไปแล้ว</th>
                    <th className="py-3 px-3">สถานะล็อตส่ง</th>
                    <th className="py-3 px-3">สถานะงาน</th>
                    <th className="py-3 pr-5 pl-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F7ECE9]">
                  {filteredTasks.map((task) => {
                    const order = data.orders.find((o) => o.id === task.orderId);
                    const lotInfo = getLatestLotInfoForTask(task, data.shippingLots);
                    const remaining = Math.max(0, task.quantityOrdered - lotInfo.shippedQty);

                    return (
                      <tr key={task.id} className="transition-colors hover:bg-[#FCF5EE]">
                        <td className="py-3 pr-3 pl-5">
                          <button
                            type="button"
                            onClick={() =>
                              task.sampleImageUrl &&
                              setPreviewImage({
                                url: task.sampleImageUrl,
                                title: task.itemName,
                              })
                            }
                            className="block focus:outline-none"
                            title={task.sampleImageUrl ? 'คลิกดูรูปขยาย' : undefined}
                          >
                            <ProductImage
                              src={task.sampleImageUrl}
                              alt={task.itemName}
                              className="h-11 w-11"
                            />
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono-num text-xs font-semibold text-[#B5566A]">
                            {task.orderNo}
                          </div>
                          <div className="text-xs text-[#7A6368]">
                            {order?.customerName || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-[#3B2D30]">{task.itemName}</div>
                          <div className="font-mono-num text-xs text-[#7A6368]">
                            {formatBaht(task.unitPrice)} / ชิ้น
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-[#5A4448]">{task.category}</td>
                        <td className="font-mono-num py-3 px-3 text-right font-semibold text-[#3B2D30]">
                          {formatNumber(task.quantityOrdered)}
                        </td>
                        <td className="font-mono-num py-3 px-3 text-right">
                          <span
                            className={`font-semibold ${
                              lotInfo.shippedQty >= task.quantityOrdered
                                ? 'text-[#3E7255]'
                                : 'text-[#3B2D30]'
                            }`}
                          >
                            {formatNumber(lotInfo.shippedQty)}
                          </span>
                          {remaining > 0 && (
                            <span className="ml-1 text-[11px] text-[#987E83]">
                              (ค้าง {remaining})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs text-[#5A4448]">
                          {lotInfo.latestLotNumber !== null ? (
                            <span className="font-mono-num">
                              ส่งถึง Lot {lotInfo.latestLotNumber} แล้ว
                            </span>
                          ) : (
                            <span className="text-[#A88F94]">ยังไม่เคยส่ง</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <StatusLabel status={task.status} />
                        </td>
                        <td className="py-3 pr-5 pl-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onQuickLogShipping(task.orderId, task.id)}
                              title="บันทึกส่งล็อต"
                              className="inline-flex items-center gap-1 rounded-lg bg-[#E8F3EC] px-2.5 py-1.5 text-xs font-medium text-[#3E7255] hover:bg-[#D7EBDF] whitespace-nowrap"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              <span>ส่งล็อต</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(task)}
                              title="แก้ไข"
                              className="rounded-lg p-1.5 text-[#6A5559] hover:bg-[#FCECEF] hover:text-[#B5566A]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task)}
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
            {filteredTasks.map((task) => {
              const order = data.orders.find((o) => o.id === task.orderId);
              const lotInfo = getLatestLotInfoForTask(task, data.shippingLots);

              return (
                <div
                  key={task.id}
                  className="rounded-xl border border-[#EDDCD9] bg-white p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        task.sampleImageUrl &&
                        setPreviewImage({ url: task.sampleImageUrl, title: task.itemName })
                      }
                      className="shrink-0"
                    >
                      <ProductImage
                        src={task.sampleImageUrl}
                        alt={task.itemName}
                        className="h-14 w-14"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-num text-xs font-semibold text-[#B5566A]">
                          {task.orderNo}
                        </span>
                        <StatusLabel status={task.status} />
                      </div>
                      <h3 className="mt-0.5 truncate text-sm font-semibold text-[#3B2D30]">
                        {task.itemName}
                      </h3>
                      <p className="text-xs text-[#7A6368]">
                        {order?.customerName || '—'} · {task.category}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 border-t border-[#F7ECE9] pt-3 text-xs">
                    <div>
                      <span className="text-[#7A6368]">สั่ง:</span>{' '}
                      <span className="font-mono-num font-semibold text-[#3B2D30]">
                        {task.quantityOrdered}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#7A6368]">ส่งแล้ว:</span>{' '}
                      <span className="font-mono-num font-semibold text-[#3E7255]">
                        {lotInfo.shippedQty}
                      </span>
                    </div>
                    <div className="text-right font-mono-num text-[#5A4448]">
                      {lotInfo.latestLotNumber !== null
                        ? `ถึง Lot ${lotInfo.latestLotNumber}`
                        : 'ยังไม่ส่ง'}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onQuickLogShipping(task.orderId, task.id)}
                      className="min-h-[38px] rounded-lg bg-[#E8F3EC] px-3 py-1.5 text-xs font-medium text-[#3E7255]"
                    >
                      บันทึกส่งล็อต
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(task)}
                      className="min-h-[38px] rounded-lg border border-[#E7D4D7] px-3 py-1.5 text-xs font-medium text-[#6A5559]"
                    >
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task)}
                      className="min-h-[38px] rounded-lg border border-[#E7D4D7] px-3 py-1.5 text-xs font-medium text-[#B91C1C]"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B2D30]/70 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[#3B2D30]">{previewImage.title}</p>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="rounded-lg p-1 text-[#7A6368] hover:bg-[#FAF1EC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.title}
              referrerPolicy="no-referrer"
              className="aspect-square w-full rounded-lg object-cover"
            />
          </div>
        </div>
      )}

      {/* Create / Edit Task Modal */}
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
                {editingTask ? 'แก้ไขงานที่ต้องทำ' : 'เพิ่มงานที่ต้องทำ'}
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
              <div>
                <label className="block text-xs font-medium text-[#5A4448]">
                  หมายเลขของออเดอร์ *
                </label>
                <select
                  required
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] bg-white px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                >
                  {data.orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.orderNo} — {ord.customerName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-[#F5EAE8] bg-[#FCF5EE] p-3.5">
                <label className="block text-xs font-medium text-[#B5566A]">
                  ดึงข้อมูลจากรายการสินค้าในร้าน (เติมชื่อ ประเภท ราคา และรูปให้อัตโนมัติ)
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="mt-1.5 min-h-[38px] w-full rounded-lg border border-[#E7D4D7] bg-white px-3 py-1.5 text-sm focus:border-[#C96A7E] focus:outline-none"
                >
                  <option value="">— เลือกจากคลังสินค้า หรือกรอกเองด้านล่าง —</option>
                  {data.products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.category} · {formatBaht(prod.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    รายการที่สั่ง *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="เช่น ทิวลิปไหมพรม"
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    ประเภทของงาน *
                  </label>
                  <input
                    type="text"
                    list="task-category-list"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                  <datalist id="task-category-list">
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    จำนวนที่สั่ง *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={quantityOrdered}
                    onChange={(e) => setQuantityOrdered(Number(e.target.value))}
                    className="font-mono-num mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    ราคาต่อชิ้น (บาท)
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
                    สถานะของงาน
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] bg-white px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  >
                    {TASK_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5A4448]">
                  รูปตัวอย่างสินค้า (อัปโหลดจากมือถือ/คอม หรือเลือกรูปสินค้า)
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <ProductImage
                    src={sampleImageUrl}
                    alt="ตัวอย่างสินค้า"
                    className="h-16 w-16"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImage}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7D4D7] bg-white px-3 py-1.5 text-xs font-medium text-[#3B2D30] hover:bg-[#FAF1EC]"
                      >
                        <ImagePlus className="h-3.5 w-3.5 text-[#C96A7E]" />
                        <span>อัปโหลดรูปภาพ</span>
                      </button>
                      {sampleImageUrl && (
                        <button
                          type="button"
                          onClick={() => setSampleImageUrl('')}
                          className="rounded-lg border border-[#E7D4D7] px-2.5 py-1.5 text-xs text-[#7A6368] hover:bg-[#FAF1EC]"
                        >
                          ลบรูป
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_IMAGES.map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => setSampleImageUrl(preset.url)}
                          className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                            sampleImageUrl === preset.url
                              ? 'border-[#C96A7E] bg-[#FCECEF] text-[#B5566A]'
                              : 'border-[#EDDCD9] bg-[#FCF5EE] text-[#6A5559] hover:border-[#DFAEB8]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {imageError && (
                  <p className="mt-1.5 text-xs text-[#B91C1C]">{imageError}</p>
                )}
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
                บันทึกงาน
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
