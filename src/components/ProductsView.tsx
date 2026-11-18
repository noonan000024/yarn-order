import React, { useMemo, useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { PRESET_IMAGES, PRODUCT_CATEGORIES } from '../data/initialData';
import { AppData, Product } from '../types/studio';
import {
  calculateProductSalesFromLots,
  formatBaht,
  formatNumber,
} from '../utils/calculations';
import { resizeImageToDataUrl } from '../utils/imageUtils';
import { ProductImage } from './ProductDisplay';

interface ProductsViewProps {
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
}

export const ProductsView: React.FC<ProductsViewProps> = ({ data, onSaveWithSync }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ทั้งหมด');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]);
  const [price, setPrice] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const productMetrics = useMemo(() => {
    const metrics = calculateProductSalesFromLots(data.products, data.shippingLots);
    return metrics.sort((a, b) => b.revenueExclShipping - a.revenueExclShipping);
  }, [data.products, data.shippingLots]);

  const categoriesAvailable = useMemo(() => {
    const set = new Set<string>(PRODUCT_CATEGORIES);
    data.products.forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [data.products]);

  const filteredMetrics = useMemo(() => {
    return productMetrics.filter(({ product }) => {
      if (categoryFilter !== 'ทั้งหมด' && product.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          product.name.toLowerCase().includes(q) ||
          product.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [productMetrics, categoryFilter, searchQuery]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setCategory(PRODUCT_CATEGORIES[0]);
    setPrice(150);
    setImageUrl('');
    setImageError(null);
    setIsFormOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category);
    setPrice(product.price);
    setImageUrl(product.imageUrl || '');
    setImageError(null);
    setIsFormOpen(true);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    try {
      const compressed = await resizeImageToDataUrl(file, 240, 0.68);
      setImageUrl(compressed);
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : 'อัปโหลดรูปไม่สำเร็จ');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingProduct) {
      const nextProducts = data.products.map((p) =>
        p.id === editingProduct.id
          ? {
              ...p,
              name: name.trim(),
              category: category.trim() || PRODUCT_CATEGORIES[0],
              price: Math.max(0, Number(price) || 0),
              imageUrl: imageUrl.trim() || undefined,
            }
          : p
      );
      setIsFormOpen(false);
      onSaveWithSync(
        { ...data, products: nextProducts },
        {
          title: 'บันทึกการแก้ไขสินค้า',
          description: `อัปเดตข้อมูลสินค้า "${name.trim()}" (${formatBaht(price)}) และสำรองลง Google Sheet ทันที`,
          successMessage: `อัปเดตสินค้า "${name.trim()}" เรียบร้อย`,
        }
      );
    } else {
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        name: name.trim(),
        category: category.trim() || PRODUCT_CATEGORIES[0],
        price: Math.max(0, Number(price) || 0),
        imageUrl: imageUrl.trim() || undefined,
      };
      setIsFormOpen(false);
      onSaveWithSync(
        { ...data, products: [newProduct, ...data.products] },
        {
          title: 'เพิ่มสินค้าใหม่ในร้าน',
          description: `เพิ่มสินค้า "${newProduct.name}" ราคา ${formatBaht(newProduct.price)} และสำรองข้อมูลลง Google Sheet ทันที`,
          successMessage: `เพิ่มสินค้า "${newProduct.name}" แล้ว`,
        }
      );
    }
  };

  const handleDeleteProduct = (product: Product) => {
    const nextProducts = data.products.filter((p) => p.id !== product.id);
    onSaveWithSync(
      { ...data, products: nextProducts },
      {
        title: 'ยืนยันการลบสินค้า',
        description: `ต้องการลบสินค้า "${product.name}" ออกจากคลังสินค้าและ Google Sheet ใช่หรือไม่? (ประวัติออเดอร์เก่าจะยังคงอยู่)`,
        confirmLabel: 'ลบและอัปเดต Google Sheet',
        successMessage: `ลบสินค้า "${product.name}" เรียบร้อย`,
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
              placeholder="ค้นหาชื่อสินค้า หรือประเภท..."
              className="min-h-[40px] w-full rounded-lg border border-[#E7D4D7] bg-white py-2 pr-3 pl-9 text-sm text-[#3B2D30] placeholder-[#A88F94] focus:border-[#C96A7E] focus:outline-none"
            />
          </div>

          <select
            aria-label="กรองตามประเภทสินค้า"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[40px] rounded-lg border border-[#E7D4D7] bg-white px-3 py-2 text-xs font-medium text-[#3B2D30] focus:border-[#C96A7E] focus:outline-none"
          >
            <option value="ทั้งหมด">ทุกประเภท</option>
            {categoriesAvailable.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#C96A7E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B5566A] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>เพิ่มสินค้าในร้าน</span>
        </button>
      </div>

      {/* Product Grid */}
      {filteredMetrics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E7D4D7] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#5A4448]">ไม่พบรายการสินค้า</p>
          <p className="mt-1 text-xs text-[#8A7075]">
            เพิ่มสินค้าถักไหมพรมของร้านเพื่อใช้ดึงข้อมูลลงหน้างานที่ต้องทำและติดตามยอดขาย
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMetrics.map(({ product, unitsSold, revenueExclShipping, lotCount }) => {
            const rank = productMetrics.findIndex((m) => m.product.id === product.id) + 1;
            const isTopSeller = revenueExclShipping > 0 && rank <= 3;

            return (
              <div
                key={product.id}
                className="flex flex-col justify-between rounded-xl border border-[#EDDCD9] bg-white p-4 transition-colors hover:border-[#DFAEB8]"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-20 w-20"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-[#7A6368]">
                        <span className="truncate">{product.category}</span>
                        {isTopSeller && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-[#B5566A] whitespace-nowrap">
                              ขายดีอันดับ {rank}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="mt-1 text-base font-semibold text-[#3B2D30] leading-snug">
                        {product.name}
                      </h3>
                      <p className="font-mono-num mt-1 text-sm font-semibold text-[#3E7255]">
                        {formatBaht(product.price)}{' '}
                        <span className="text-xs font-normal text-[#7A6368]">/ ชิ้น</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-[#F7ECE9] pt-3">
                  <div>
                    <p className="text-[11px] text-[#7A6368]">ยอดขายจากล็อตส่ง</p>
                    <p className="font-mono-num text-sm font-semibold text-[#3B2D30]">
                      {formatBaht(revenueExclShipping)}
                    </p>
                    <p className="font-mono-num text-xs text-[#7A6368]">
                      {formatNumber(unitsSold)} ชิ้น ({lotCount} ล็อต)
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(product)}
                      title="แก้ไขสินค้า"
                      className="rounded-lg p-2 text-[#6A5559] hover:bg-[#FCECEF] hover:text-[#B5566A]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product)}
                      title="ลบสินค้า"
                      className="rounded-lg p-2 text-[#B91C1C]/70 hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#3B2D30]/40 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmit}
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-[#EBD8D4] bg-white p-6 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-[#F5EAE8] pb-3">
              <h3 className="text-base font-semibold text-[#3B2D30]">
                {editingProduct ? 'แก้ไขข้อมูลสินค้า' : 'เพิ่มสินค้าใหม่ในร้าน'}
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
                  ชื่อสินค้า *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ช่อทิวลิปไหมพรม 5 ดอก"
                  className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    ประเภท *
                  </label>
                  <input
                    type="text"
                    list="product-category-list"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                  <datalist id="product-category-list">
                    {categoriesAvailable.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4448]">
                    ราคาต่อชิ้น (บาท) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="font-mono-num mt-1 min-h-[40px] w-full rounded-lg border border-[#E7D4D7] px-3 py-2 text-sm focus:border-[#C96A7E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5A4448]">
                  รูปสินค้า
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <ProductImage src={imageUrl} alt={name || 'สินค้า'} className="h-16 w-16" />
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
                        <span>อัปโหลดรูป</span>
                      </button>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
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
                          onClick={() => setImageUrl(preset.url)}
                          className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                            imageUrl === preset.url
                              ? 'border-[#C96A7E] bg-[#FCECEF] text-[#B5566A]'
                              : 'border-[#EDDCD9] bg-[#FCF5EE] text-[#6A5559]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {imageError && <p className="mt-1 text-xs text-[#B91C1C]">{imageError}</p>}
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
                บันทึกสินค้า
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
