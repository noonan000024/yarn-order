import {
  AppData,
  Order,
  OrderStatus,
  Product,
  ShippingLot,
  ShippingStatus,
  TaskItem,
  TaskStatus,
} from '../types/studio';

export const BACKUP_SPREADSHEET_NAME = 'YarnBloom_Studio_Backup';

const SHEET_TABS = {
  PRODUCTS: 'Products',
  ORDERS: 'Orders',
  TASKS: 'Tasks',
  SHIPPING_LOTS: 'ShippingLots',
} as const;

const HEADERS = {
  [SHEET_TABS.PRODUCTS]: ['id', 'ชื่อสินค้า', 'ประเภท', 'ราคา', 'รูปตัวอย่าง'],
  [SHEET_TABS.ORDERS]: ['id', 'หมายเลข Order', 'ชื่อลูกค้า', 'วันที่สั่งงาน', 'สถานะ', 'หมายเหตุ'],
  [SHEET_TABS.TASKS]: [
    'id',
    'orderId',
    'หมายเลข Order',
    'productId',
    'รายการที่สั่ง',
    'ประเภทของงาน',
    'จำนวนที่สั่ง',
    'ราคาต่อชิ้น',
    'สถานะงาน',
    'รูปตัวอย่าง',
  ],
  [SHEET_TABS.SHIPPING_LOTS]: [
    'id',
    'orderId',
    'หมายเลข Order',
    'ชื่อลูกค้า',
    'Lot ที่',
    'taskId',
    'งานที่ต้องทำ',
    'ประเภทของงาน',
    'จำนวนที่ส่ง',
    'ราคาต่อชิ้น',
    'ค่าส่ง',
    'วันที่ส่ง',
    'สถานะการส่ง',
    'รวมเป็นเงิน',
  ],
};

export interface SpreadsheetDiscoveryResult {
  spreadsheetId: string;
  spreadsheetName: string;
  webViewLink: string;
  isNew: boolean;
}

export class AuthExpiredError extends Error {
  constructor(message = 'สิทธิ์เชื่อมต่อ Google หมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

async function googleFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new AuthExpiredError();
  }

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      detail = await res.text();
    }
    throw new Error(`Google API Error (${res.status}): ${detail}`);
  }

  return res.json();
}

/**
 * Automatically finds the shared YarnBloom_Studio_Backup Google Sheet in the user's Drive
 * across any device (no URL input required). Creates it if none exists yet.
 */
export async function findOrCreateBackupSpreadsheet(
  accessToken: string
): Promise<SpreadsheetDiscoveryResult> {
  const query = encodeURIComponent(
    `name='${BACKUP_SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );
  const fields = encodeURIComponent('files(id,name,webViewLink,modifiedTime)');
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=5`;

  const searchRes = await googleFetch(listUrl, accessToken);
  const files = searchRes.files || [];

  if (files.length > 0) {
    const existing = files[0];
    return {
      spreadsheetId: existing.id,
      spreadsheetName: existing.name || BACKUP_SPREADSHEET_NAME,
      webViewLink:
        existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}/edit`,
      isNew: false,
    };
  }

  // Create a new structured spreadsheet
  const createRes = await googleFetch('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title: BACKUP_SPREADSHEET_NAME,
        locale: 'th_TH',
      },
      sheets: [
        { properties: { title: SHEET_TABS.PRODUCTS } },
        { properties: { title: SHEET_TABS.ORDERS } },
        { properties: { title: SHEET_TABS.TASKS } },
        { properties: { title: SHEET_TABS.SHIPPING_LOTS } },
      ],
    }),
  });

  const spreadsheetId = createRes.spreadsheetId as string;
  const webViewLink =
    createRes.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return {
    spreadsheetId,
    spreadsheetName: BACKUP_SPREADSHEET_NAME,
    webViewLink,
    isNew: true,
  };
}

async function ensureRequiredTabs(accessToken: string, spreadsheetId: string): Promise<void> {
  const meta = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    accessToken
  );

  const existingTitles = new Set<string>(
    (meta.sheets || []).map((s: { properties?: { title?: string } }) => s.properties?.title || '')
  );

  const requiredTitles = Object.values(SHEET_TABS);
  const missingTitles = requiredTitles.filter((title) => !existingTitles.has(title));

  if (missingTitles.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: missingTitles.map((title) => ({
            addSheet: { properties: { title } },
          })),
        }),
      }
    );
  }
}

export async function readAllFromSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<AppData> {
  await ensureRequiredTabs(accessToken, spreadsheetId);

  const ranges = [
    `${SHEET_TABS.PRODUCTS}!A1:E`,
    `${SHEET_TABS.ORDERS}!A1:F`,
    `${SHEET_TABS.TASKS}!A1:J`,
    `${SHEET_TABS.SHIPPING_LOTS}!A1:N`,
  ]
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join('&');

  const res = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges}`,
    accessToken
  );

  const valueRanges = res.valueRanges || [];
  const productRows: string[][] = valueRanges[0]?.values || [];
  const orderRows: string[][] = valueRanges[1]?.values || [];
  const taskRows: string[][] = valueRanges[2]?.values || [];
  const lotRows: string[][] = valueRanges[3]?.values || [];

  const products: Product[] = productRows
    .slice(1)
    .filter((r) => r[0] && r[1])
    .map((r) => ({
      id: String(r[0]),
      name: String(r[1]),
      category: String(r[2] || 'ช่อดอกไม้'),
      price: Number(r[3]) || 0,
      imageUrl: r[4] ? String(r[4]) : undefined,
    }));

  const orders: Order[] = orderRows
    .slice(1)
    .filter((r) => r[0] && r[1])
    .map((r) => ({
      id: String(r[0]),
      orderNo: String(r[1]),
      customerName: String(r[2] || ''),
      orderDate: String(r[3] || ''),
      status: (r[4] as OrderStatus) || 'รอดำเนินการ',
      notes: r[5] ? String(r[5]) : undefined,
    }));

  const tasks: TaskItem[] = taskRows
    .slice(1)
    .filter((r) => r[0] && r[1])
    .map((r) => ({
      id: String(r[0]),
      orderId: String(r[1]),
      orderNo: String(r[2] || ''),
      productId: r[3] ? String(r[3]) : undefined,
      itemName: String(r[4] || ''),
      category: String(r[5] || ''),
      quantityOrdered: Number(r[6]) || 0,
      unitPrice: Number(r[7]) || 0,
      status: (r[8] as TaskStatus) || 'รอถัก',
      sampleImageUrl: r[9] ? String(r[9]) : undefined,
    }));

  const shippingLots: ShippingLot[] = lotRows
    .slice(1)
    .filter((r) => r[0] && r[1])
    .map((r) => {
      const qty = Number(r[8]) || 0;
      const unitPrice = Number(r[9]) || 0;
      const fee = Number(r[10]) || 0;
      const total = Number(r[13]) || qty * unitPrice + fee;
      return {
        id: String(r[0]),
        orderId: String(r[1]),
        orderNo: String(r[2] || ''),
        customerName: String(r[3] || ''),
        lotNumber: Number(r[4]) || 1,
        taskId: r[5] ? String(r[5]) : undefined,
        itemName: String(r[6] || ''),
        category: String(r[7] || ''),
        quantityShipped: qty,
        unitPrice,
        shippingFee: fee,
        shipDate: String(r[11] || ''),
        status: (r[12] as ShippingStatus) || 'เตรียมส่ง',
        totalAmount: total,
      };
    });

  return { products, orders, tasks, shippingLots };
}

function safeCellText(val?: string): string {
  if (!val) return '';
  // Google Sheets single cell limit is 50,000 characters
  return val.length > 48000 ? '' : val;
}

export async function writeAllToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  data: AppData
): Promise<void> {
  await ensureRequiredTabs(accessToken, spreadsheetId);

  const clearRanges = [
    `${SHEET_TABS.PRODUCTS}!A1:E`,
    `${SHEET_TABS.ORDERS}!A1:F`,
    `${SHEET_TABS.TASKS}!A1:J`,
    `${SHEET_TABS.SHIPPING_LOTS}!A1:N`,
  ];

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ ranges: clearRanges }),
    }
  );

  const productValues = [
    HEADERS[SHEET_TABS.PRODUCTS],
    ...data.products.map((p) => [
      p.id,
      p.name,
      p.category,
      p.price,
      safeCellText(p.imageUrl),
    ]),
  ];

  const orderValues = [
    HEADERS[SHEET_TABS.ORDERS],
    ...data.orders.map((o) => [
      o.id,
      o.orderNo,
      o.customerName,
      o.orderDate,
      o.status,
      o.notes || '',
    ]),
  ];

  const taskValues = [
    HEADERS[SHEET_TABS.TASKS],
    ...data.tasks.map((t) => [
      t.id,
      t.orderId,
      t.orderNo,
      t.productId || '',
      t.itemName,
      t.category,
      t.quantityOrdered,
      t.unitPrice,
      t.status,
      safeCellText(t.sampleImageUrl),
    ]),
  ];

  const lotValues = [
    HEADERS[SHEET_TABS.SHIPPING_LOTS],
    ...data.shippingLots.map((l) => [
      l.id,
      l.orderId,
      l.orderNo,
      l.customerName,
      l.lotNumber,
      l.taskId || '',
      l.itemName,
      l.category,
      l.quantityShipped,
      l.unitPrice,
      l.shippingFee,
      l.shipDate,
      l.status,
      l.totalAmount,
    ]),
  ];

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `${SHEET_TABS.PRODUCTS}!A1`, values: productValues },
          { range: `${SHEET_TABS.ORDERS}!A1`, values: orderValues },
          { range: `${SHEET_TABS.TASKS}!A1`, values: taskValues },
          { range: `${SHEET_TABS.SHIPPING_LOTS}!A1`, values: lotValues },
        ],
      }),
    }
  );
}
