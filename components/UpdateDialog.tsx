import React from 'react';
import { Download, X, Sparkles, ExternalLink, ChevronDown } from 'lucide-react';
import type { ReleaseInfo } from '../services/updateService';
import { openDownloadLink, CURRENT_VERSION } from '../services/updateService';

interface UpdateDialogProps {
  release: ReleaseInfo;
  onDismiss: () => void;
}

const formatDate = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export const UpdateDialog: React.FC<UpdateDialogProps> = ({ release, onDismiss }) => {
  const handleUpdate = () => {
    openDownloadLink(release.downloadUrl);
  };

  // Giới hạn ghi chú phiên bản (tránh quá dài)
  const notes = release.releaseNotes.length > 400
    ? release.releaseNotes.substring(0, 400) + '...'
    : release.releaseNotes;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
    >
      {/* Dialog Card */}
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-2xl"
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #0d2d2a 60%, #0a1f1e 100%)',
          boxShadow: '0 -8px 60px rgba(13,124,102,0.35), 0 0 0 1px rgba(13,124,102,0.2)',
          animation: 'slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Decorative top bar */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #0d7c66, #06b6d4, #0d7c66)' }} />

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #0d7c66, #059669)' }}
            >
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Có phiên bản mới!</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400 line-through">{CURRENT_VERSION}</span>
                <span className="text-slate-500 text-xs">→</span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{ background: '#0d7c66' }}
                >
                  v{release.version}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="rounded-full p-2 text-slate-400 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Release info bar */}
        <div
          className="mx-6 mb-4 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: 'rgba(13,124,102,0.12)', border: '1px solid rgba(13,124,102,0.2)' }}
        >
          <ExternalLink className="h-4 w-4 flex-shrink-0" style={{ color: '#0d7c66' }} />
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-300">Phát hành ngày {formatDate(release.publishedAt)}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {release.isAndroid ? '✓ File APK đính kèm sẵn' : '⚠ Mở trang release để tải'}
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: 'rgba(13,124,102,0.25)', color: '#34d399' }}
          >
            {release.tagName}
          </span>
        </div>

        {/* Release notes */}
        {release.releaseNotes && release.releaseNotes !== 'Không có ghi chú phiên bản.' && (
          <div className="mx-6 mb-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <ChevronDown className="h-3 w-3" /> Ghi chú phiên bản
            </p>
            <div
              className="rounded-xl p-4 text-xs text-slate-300 leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <pre className="whitespace-pre-wrap font-sans">{notes}</pre>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-slate-400 transition-all"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            Để sau
          </button>
          <button
            onClick={handleUpdate}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #0d7c66 0%, #059669 100%)',
              boxShadow: '0 4px 20px rgba(13,124,102,0.4)',
            }}
          >
            <Download className="h-4 w-4" />
            Tải về cập nhật
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @media (min-width: 640px) {
          @keyframes slideUp {
            from { transform: scale(0.9) translateY(20px); opacity: 0; }
            to   { transform: scale(1)   translateY(0);    opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
};
