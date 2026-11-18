import React from 'react';
import { AlertTriangle, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { PendingSyncAction } from '../types/studio';

interface ConfirmSyncModalProps {
  action: PendingSyncAction | null;
  spreadsheetName: string;
  isSyncing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmSyncModal: React.FC<ConfirmSyncModalProps> = ({
  action,
  spreadsheetName,
  isSyncing,
  onConfirm,
  onCancel,
}) => {
  if (!action) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B2D30]/40 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-sync-title"
    >
      <div className="w-full max-w-md rounded-xl border border-[#EBD8D4] bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                action.isDestructive
                  ? 'border-[#DC2626]/20 bg-[#FEE2E2]/60 text-[#B91C1C]'
                  : 'border-[#4E8767]/25 bg-[#E8F3EC] text-[#3E7255]'
              }`}
            >
              {action.isDestructive ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <FileSpreadsheet className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3
                id="confirm-sync-title"
                className="text-base font-semibold text-[#3B2D30]"
              >
                {action.title}
              </h3>
              <p className="mt-0.5 text-xs text-[#7A6368]">
                ไฟล์สำรอง: {spreadsheetName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSyncing}
            className="rounded-lg p-1.5 text-[#7A6368] transition-colors hover:bg-[#FAF1EC] hover:text-[#3B2D30] disabled:opacity-50"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-[#5A4448]">
          {action.description}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#F2E5E2] pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSyncing}
            className="min-h-[40px] rounded-lg border border-[#E7D4D7] bg-white px-4 py-2 text-sm font-medium text-[#5A4448] transition-colors hover:bg-[#FAF1EC] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSyncing}
            className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 ${
              action.isDestructive
                ? 'bg-[#B91C1C] hover:bg-[#991B1B]'
                : 'bg-[#C96A7E] hover:bg-[#B5566A]'
            }`}
          >
            {isSyncing && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>
              {isSyncing
                ? 'กำลังบันทึกลง Google Sheet...'
                : action.confirmLabel || 'ยืนยันและบันทึกลง Google Sheet'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
