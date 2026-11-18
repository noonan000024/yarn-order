import React, { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ClipboardList,
  ExternalLink,
  FileSpreadsheet,
  Flower2,
  LayoutDashboard,
  ListTodo,
  LogOut,
  RefreshCw,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import { ConfirmSyncModal } from './components/ConfirmSyncModal';
import { DashboardView } from './components/DashboardView';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { OrdersView } from './components/OrdersView';
import { ProductsView } from './components/ProductsView';
import { ShippingLotsView } from './components/ShippingLotsView';
import { TasksView } from './components/TasksView';
import { INITIAL_APP_DATA } from './data/initialData';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleAuth';
import {
  AuthExpiredError,
  BACKUP_SPREADSHEET_NAME,
  findOrCreateBackupSpreadsheet,
  readAllFromSpreadsheet,
  writeAllToSpreadsheet,
} from './services/googleSheetsSync';
import {
  AppData,
  PageTab,
  PendingSyncAction,
  SheetConnectionInfo,
} from './types/studio';

const LOCAL_CACHE_KEY = 'yarnbloom_studio_data_v1';

const NAV_ITEMS: { id: PageTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'แดชบอร์ด',
    shortLabel: 'ภาพรวม',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    id: 'orders',
    label: 'ใบออเดอร์',
    shortLabel: 'ออเดอร์',
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    id: 'tasks',
    label: 'งานที่ต้องทำ',
    shortLabel: 'คิวงาน',
    icon: <ListTodo className="h-4 w-4" />,
  },
  {
    id: 'shipping',
    label: 'สถานะการส่งงาน',
    shortLabel: 'ส่งงาน',
    icon: <Truck className="h-4 w-4" />,
  },
  {
    id: 'products',
    label: 'สินค้าในร้าน',
    shortLabel: 'สินค้า',
    icon: <ShoppingBag className="h-4 w-4" />,
  },
];

function loadCachedData(): AppData {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return INITIAL_APP_DATA;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.products) &&
      Array.isArray(parsed.orders) &&
      Array.isArray(parsed.tasks) &&
      Array.isArray(parsed.shippingLots)
    ) {
      return parsed;
    }
    return INITIAL_APP_DATA;
  } catch {
    return INITIAL_APP_DATA;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<PageTab>('dashboard');
  const [data, setData] = useState<AppData>(() => loadCachedData());
  const [prefillShipping, setPrefillShipping] = useState<{
    orderId: string;
    taskId?: string;
    nonce: number;
  } | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [sheetInfo, setSheetInfo] = useState<SheetConnectionInfo | null>(null);

  const [pendingSync, setPendingSync] = useState<PendingSyncAction | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage quota errors
    }
  }, [data]);

  const connectAndLoadSpreadsheet = useCallback(
    async (accessToken: string, currentLocalData: AppData) => {
      const discovery = await findOrCreateBackupSpreadsheet(accessToken);
      const info: SheetConnectionInfo = {
        spreadsheetId: discovery.spreadsheetId,
        spreadsheetName: discovery.spreadsheetName,
        webViewLink: discovery.webViewLink,
        lastSyncedAt: null,
      };
      setSheetInfo(info);

      if (discovery.isNew) {
        setPendingSync({
          title: 'สร้างไฟล์สำรอง Google Sheet ใหม่สำเร็จ',
          description: `สร้างไฟล์ "${discovery.spreadsheetName}" ใน Google Drive ของคุณแล้ว ต้องการบันทึกข้อมูลรายการสินค้าและออเดอร์ปัจจุบันลงในไฟล์สำรองทันทีหรือไม่?`,
          confirmLabel: 'บันทึกลง Google Sheet ทันที',
          nextData: currentLocalData,
          successMessage: 'สำรองข้อมูลลง Google Sheet เรียบร้อยแล้ว',
        });
      } else {
        const remoteData = await readAllFromSpreadsheet(accessToken, discovery.spreadsheetId);
        const hasRemoteContent =
          remoteData.products.length > 0 ||
          remoteData.orders.length > 0 ||
          remoteData.tasks.length > 0 ||
          remoteData.shippingLots.length > 0;

        if (hasRemoteContent) {
          setData(remoteData);
          setSheetInfo((prev) =>
            prev ? { ...prev, lastSyncedAt: new Date().toLocaleTimeString('th-TH') } : prev
          );
          showToast('ซิงค์ข้อมูลจาก Google Sheet เรียบร้อยแล้ว', 'success');
        } else {
          setPendingSync({
            title: 'พบไฟล์ Google Sheet ที่ยังไม่มีข้อมูล',
            description: `เชื่อมต่อกับไฟล์ "${discovery.spreadsheetName}" แล้ว ต้องการส่งข้อมูลปัจจุบันจากแอพเข้าไปสำรองใน Google Sheet นี้หรือไม่?`,
            confirmLabel: 'บันทึกลง Google Sheet ทันที',
            nextData: currentLocalData,
            successMessage: 'สำรองข้อมูลลง Google Sheet เรียบร้อยแล้ว',
          });
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    const unsub = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
      },
      (maybeUser) => {
        setUser(maybeUser);
        setNeedsAuth(true);
        setSheetInfo(null);
      }
    );
    return () => unsub();
  }, []);

  const handleGoogleLogin = async () => {
    setIsConnecting(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        await connectAndLoadSpreadsheet(result.accessToken, data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เชื่อมต่อ Google ไม่สำเร็จ';
      showToast(msg, 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setSheetInfo(null);
    showToast('ออกจากระบบ Google แล้ว', 'info');
  };

  const handleRefreshFromSheet = async () => {
    const token = await getAccessToken();
    if (!token || !sheetInfo) {
      setNeedsAuth(true);
      showToast('กรุณาเชื่อมต่อ Google เพื่อซิงค์ข้อมูลล่าสุด', 'info');
      return;
    }

    setIsRefreshing(true);
    try {
      const remoteData = await readAllFromSpreadsheet(token, sheetInfo.spreadsheetId);
      setData(remoteData);
      setSheetInfo((prev) =>
        prev ? { ...prev, lastSyncedAt: new Date().toLocaleTimeString('th-TH') } : prev
      );
      showToast('ดึงข้อมูลล่าสุดจาก Google Sheet แล้ว', 'success');
    } catch (err: unknown) {
      if (err instanceof AuthExpiredError) {
        clearAccessToken();
        setNeedsAuth(true);
        showToast(err.message, 'error');
      } else {
        showToast(err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลได้', 'error');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveWithSync = useCallback(
    async (
      nextData: AppData,
      summary: {
        title: string;
        description: string;
        confirmLabel?: string;
        successMessage: string;
        isDestructive?: boolean;
      }
    ) => {
      const token = await getAccessToken();
      if (token && sheetInfo && !needsAuth) {
        setPendingSync({
          title: summary.title,
          description: summary.description,
          confirmLabel: summary.confirmLabel || 'ยืนยันและบันทึกลง Google Sheet',
          nextData,
          successMessage: summary.successMessage,
          isDestructive: summary.isDestructive,
        });
      } else {
        if (summary.isDestructive) {
          setPendingSync({
            title: summary.title,
            description: summary.description,
            confirmLabel: 'ยืนยันการลบ',
            nextData,
            successMessage: summary.successMessage,
            isDestructive: true,
          });
        } else {
          setData(nextData);
          showToast(
            `${summary.successMessage} (เชื่อมต่อ Google เพื่อสำรองลง Sheet อัตโนมัติ)`,
            'info'
          );
        }
      }
    },
    [sheetInfo, needsAuth, showToast]
  );

  const handleConfirmPendingSync = async () => {
    if (!pendingSync) return;
    const token = await getAccessToken();

    if (!token || !sheetInfo || needsAuth) {
      setData(pendingSync.nextData);
      showToast(pendingSync.successMessage, 'success');
      setPendingSync(null);
      return;
    }

    setIsSyncing(true);
    try {
      await writeAllToSpreadsheet(token, sheetInfo.spreadsheetId, pendingSync.nextData);
      setData(pendingSync.nextData);
      setSheetInfo((prev) =>
        prev ? { ...prev, lastSyncedAt: new Date().toLocaleTimeString('th-TH') } : prev
      );
      showToast(`${pendingSync.successMessage} · สำรองลง Google Sheet แล้ว`, 'success');
      setPendingSync(null);
    } catch (err: unknown) {
      if (err instanceof AuthExpiredError) {
        clearAccessToken();
        setNeedsAuth(true);
        setData(pendingSync.nextData);
        setPendingSync(null);
        showToast(
          'บันทึกในเครื่องแล้ว แต่สิทธิ์ Google หมดอายุ กรุณาเข้าสู่ระบบใหม่เพื่อสำรองขึ้น Sheet',
          'error'
        );
      } else {
        showToast(
          err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกลง Google Sheet',
          'error'
        );
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleQuickLogShipping = (orderId: string, taskId?: string) => {
    setPrefillShipping({ orderId, taskId, nonce: Date.now() });
    setActiveTab('shipping');
  };

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#FDF9F4] text-[#3B2D30] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-[252px] lg:shrink-0 lg:flex-col lg:justify-between border-r border-[#EDDCD9] bg-white">
        <div className="p-5">
          <div className="flex items-center gap-2.5 pb-6 border-b border-[#F5EAE8]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCECEF] text-[#C96A7E]">
              <Flower2 className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-[#3B2D30]">
                YarnBloom
              </span>
              <p className="text-[11px] text-[#7A6368]">Handmade Crochet Studio</p>
            </div>
          </div>

          <nav className="mt-5 space-y-1" aria-label="เมนูหลัก">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FCECEF] text-[#B5566A]'
                      : 'text-[#6A5559] hover:bg-[#FAF1EC] hover:text-[#3B2D30]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Google Sheet Backup Status Panel in Sidebar */}
        <div className="m-4 rounded-xl border border-[#EDDCD9] bg-[#FCF5EE] p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3B2D30]">
            <FileSpreadsheet className="h-4 w-4 text-[#4E8767]" />
            <span>สำรองข้อมูล Google Sheet</span>
          </div>

          {needsAuth || !sheetInfo ? (
            <div className="space-y-2.5">
              <p className="text-xs leading-relaxed text-[#7A6368]">
                เชื่อมต่อ Google ครั้งเดียวเพื่อซิงค์ข้อมูลอัตโนมัติทั้งคอมและมือถือ โดยไม่ต้องกรอก URL ใหม่
              </p>
              <GoogleSignInButton
                onClick={handleGoogleLogin}
                disabled={isConnecting}
                label={isConnecting ? 'กำลังเชื่อมต่อ...' : 'Sign in with Google'}
                className="w-full"
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="text-xs text-[#5A4448]">
                <p className="font-medium text-[#3B2D30] truncate">
                  {user?.email || 'เชื่อมต่อแล้ว'}
                </p>
                <p className="mt-0.5 text-[11px] text-[#7A6368] truncate">
                  ไฟล์: {sheetInfo.spreadsheetName}
                </p>
                {sheetInfo.lastSyncedAt && (
                  <p className="font-mono-num mt-0.5 text-[11px] text-[#3E7255]">
                    ซิงค์ล่าสุด {sheetInfo.lastSyncedAt}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={handleRefreshFromSheet}
                  disabled={isRefreshing}
                  className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-[#E7D4D7] bg-white px-3 py-1.5 text-xs font-medium text-[#3B2D30] hover:bg-[#FAF1EC] disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-[#4E8767] ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'กำลังโหลด...' : 'ดึงข้อมูลล่าสุดจาก Sheet'}</span>
                </button>
                <div className="flex items-center justify-between pt-1">
                  <a
                    href={sheetInfo.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3E7255] hover:underline"
                  >
                    <span>เปิดไฟล์ Sheet</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={handleGoogleLogout}
                    className="inline-flex items-center gap-1 text-[11px] text-[#7A6368] hover:text-[#B91C1C]"
                  >
                    <LogOut className="h-3 w-3" />
                    <span>ออก</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 pb-20 lg:pb-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#EDDCD9] bg-white/95 px-4 py-3 backdrop-blur-xs sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display text-sm font-bold text-[#C96A7E] lg:hidden whitespace-nowrap">
              YarnBloom
            </span>
            <span className="text-[#DFAEB8] lg:hidden" aria-hidden="true">
              /
            </span>
            <h1 className="font-display truncate text-base font-semibold text-[#3B2D30] sm:text-lg">
              {activeNav.label}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {needsAuth || !sheetInfo ? (
              <GoogleSignInButton
                onClick={handleGoogleLogin}
                disabled={isConnecting}
                label={isConnecting ? 'กำลังเชื่อมต่อ...' : 'Sign in with Google'}
              />
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshFromSheet}
                  disabled={isRefreshing}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E7D4D7] bg-white px-3 py-1.5 text-xs font-medium text-[#3B2D30] hover:bg-[#FAF1EC] disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-[#4E8767] ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">ซิงค์จาก Sheet</span>
                  <span className="sm:hidden">ซิงค์</span>
                </button>
                <a
                  href={sheetInfo.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#E8F3EC] px-3 py-1.5 text-xs font-medium text-[#3E7255] hover:bg-[#D7EBDF] whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>{BACKUP_SPREADSHEET_NAME}</span>
                </a>
              </div>
            )}
          </div>
        </header>

        {/* Cross-device sync hint banner when not connected */}
        {(needsAuth || !sheetInfo) && (
          <div className="border-b border-[#EDDCD9] bg-[#FCF5EE] px-4 py-2.5 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-[#5A4448]">
              <span>
                เข้าสู่ระบบด้วย Google เพื่อสร้างและเชื่อมไฟล์สำรอง <strong className="font-semibold text-[#3B2D30]">{BACKUP_SPREADSHEET_NAME}</strong> อัตโนมัติ (ใช้ได้ทั้งมือถือและคอมโดยไม่ต้องกรอก URL)
              </span>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isConnecting}
                className="font-semibold text-[#B5566A] hover:underline whitespace-nowrap"
              >
                {isConnecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อตอนนี้'}
              </button>
            </div>
          </div>
        )}

        {/* Page Viewport */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {activeTab === 'dashboard' && (
            <DashboardView data={data} onNavigate={setActiveTab} />
          )}
          {activeTab === 'orders' && (
            <OrdersView
              data={data}
              onSaveWithSync={handleSaveWithSync}
              onQuickLogShipping={handleQuickLogShipping}
            />
          )}
          {activeTab === 'tasks' && (
            <TasksView
              data={data}
              onSaveWithSync={handleSaveWithSync}
              onQuickLogShipping={handleQuickLogShipping}
            />
          )}
          {activeTab === 'shipping' && (
            <ShippingLotsView
              data={data}
              prefillRequest={prefillShipping}
              onClearPrefill={() => setPrefillShipping(null)}
              onSaveWithSync={handleSaveWithSync}
            />
          )}
          {activeTab === 'products' && (
            <ProductsView data={data} onSaveWithSync={handleSaveWithSync} />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[#EDDCD9] bg-white px-1 py-1.5 lg:hidden"
        aria-label="เมนูมือถือ"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium transition-colors ${
                isActive ? 'text-[#B5566A] bg-[#FCECEF]' : 'text-[#7A6368]'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Mandatory Confirmation Modal before Google Sheets Write/Delete */}
      <ConfirmSyncModal
        action={pendingSync}
        spreadsheetName={sheetInfo?.spreadsheetName || BACKUP_SPREADSHEET_NAME}
        isSyncing={isSyncing}
        onConfirm={handleConfirmPendingSync}
        onCancel={() => !isSyncing && setPendingSync(null)}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed right-4 bottom-20 z-50 max-w-sm rounded-xl border px-4 py-3 text-xs font-medium shadow-md lg:bottom-6 ${
            toast.type === 'error'
              ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
              : toast.type === 'info'
              ? 'border-[#E7D4D7] bg-white text-[#3B2D30]'
              : 'border-[#B8DBC4] bg-[#E8F3EC] text-[#2F5B42]'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
