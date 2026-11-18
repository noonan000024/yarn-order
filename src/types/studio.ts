export type OrderStatus = 'รอดำเนินการ' | 'กำลังถัก' | 'ส่งบางส่วน' | 'ส่งครบแล้ว';

export type TaskStatus = 'รอถัก' | 'กำลังถัก' | 'พร้อมส่ง' | 'ส่งบางส่วน' | 'ส่งครบแล้ว';

export type ShippingStatus = 'เตรียมส่ง' | 'กำลังจัดส่ง' | 'ส่งสำเร็จแล้ว';

export type PageTab = 'dashboard' | 'orders' | 'tasks' | 'shipping' | 'products';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string;
}

export interface Order {
  id: string;
  orderNo: string;
  customerName: string;
  orderDate: string; // YYYY-MM-DD
  status: OrderStatus;
  notes?: string;
}

export interface TaskItem {
  id: string;
  orderId: string;
  orderNo: string;
  productId?: string;
  itemName: string;
  category: string;
  quantityOrdered: number;
  unitPrice: number;
  status: TaskStatus;
  sampleImageUrl?: string;
}

export interface ShippingLot {
  id: string;
  orderId: string;
  orderNo: string;
  customerName: string;
  lotNumber: number;
  taskId?: string;
  itemName: string;
  category: string;
  quantityShipped: number;
  unitPrice: number;
  shippingFee: number;
  shipDate: string; // YYYY-MM-DD
  status: ShippingStatus;
  totalAmount: number;
}

export interface AppData {
  products: Product[];
  orders: Order[];
  tasks: TaskItem[];
  shippingLots: ShippingLot[];
}

export interface PendingSyncAction {
  title: string;
  description: string;
  confirmLabel?: string;
  nextData: AppData;
  successMessage: string;
  isDestructive?: boolean;
}

export interface SheetConnectionInfo {
  spreadsheetId: string;
  spreadsheetName: string;
  webViewLink: string;
  lastSyncedAt: string | null;
}
