import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type { ReleaseInfo } from '../services/updateService';
import {
  getUpdateDownloadStatus,
  openInstaller,
  startUpdateDownload,
} from '../services/updateService';

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

const formatProgress = (downloadedBytes: number, totalBytes: number) => {
  if (!totalBytes || totalBytes <= 0) return '';
  return `${Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))}%`;
};

export const UpdateDialog: React.FC<UpdateDialogProps> = ({ release, onDismiss }) => {
  const [downloadId, setDownloadId] = useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<
    'idle' | 'pending' | 'running' | 'paused' | 'successful' | 'failed'
  >('idle');
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!downloadId) return undefined;

    const timer = window.setInterval(async () => {
      try {
        const status = await getUpdateDownloadStatus(downloadId);
        setDownloadStatus(status.status === 'missing' ? 'failed' : status.status);
        setDownloadedBytes(status.downloadedBytes);
        setTotalBytes(status.totalBytes);

        if (!status.canRequestPackageInstalls) {
          setStatusMessage('Cần cho phép cài ứng dụng từ nguồn này một lần trong Android Settings.');
        } else if (status.status === 'successful') {
          setStatusMessage('APK đã tải xong. Android sẽ mở màn hình cài đặt.');
        } else if (status.status === 'running') {
          setStatusMessage('Đang tải bản cập nhật...');
        } else if (status.status === 'paused') {
          setStatusMessage('Tải tạm dừng. Android sẽ tiếp tục khi có mạng phù hợp.');
        } else if (status.status === 'failed') {
          setStatusMessage(`Tải APK thất bại. Mã lỗi: ${status.reason || 'unknown'}`);
        } else {
          setStatusMessage('');
        }

        if (status.status === 'successful' || status.status === 'failed') {
          window.clearInterval(timer);
        }
      } catch {
        setDownloadStatus('failed');
        setStatusMessage('Không thể theo dõi tiến độ tải APK.');
        window.clearInterval(timer);
      }
    }, 1500);

    return () => {
      window.clearInterval(timer);
    };
  }, [downloadId]);

  const progressText = useMemo(
    () => formatProgress(downloadedBytes, totalBytes),
    [downloadedBytes, totalBytes]
  );

  const handleUpdate = async () => {
    setIsBusy(true);
    try {
      if (!release.isAndroid) {
        window.open(release.downloadUrl, '_system');
        return;
      }

      const result = await startUpdateDownload(release);
      setDownloadId(result.downloadId);
      setDownloadStatus('pending');
      setStatusMessage(
        result.canRequestPackageInstalls
          ? 'Đã bắt đầu tải APK...'
          : 'Android sẽ mở màn cho phép cài ứng dụng từ nguồn này trước.'
      );
    } catch (error: any) {
      setDownloadStatus('failed');
      setStatusMessage(error?.message || 'Không thể bắt đầu tải bản cập nhật.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenInstaller = async () => {
    setIsBusy(true);
    try {
      await openInstaller();
    } catch (error: any) {
      setStatusMessage(error?.message || 'Không thể mở màn hình cài đặt.');
    } finally {
      setIsBusy(false);
    }
  };

  const notes =
    release.releaseNotes.length > 400
      ? `${release.releaseNotes.substring(0, 400)}...`
      : release.releaseNotes;

  const primaryLabel =
    downloadStatus === 'successful'
      ? 'Mở cài đặt'
      : downloadStatus === 'running' || downloadStatus === 'pending' || downloadStatus === 'paused'
        ? `Đang tải ${progressText || ''}`.trim()
        : release.isAndroid
          ? 'Tải và cài đặt'
          : 'Mở trang release';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-2xl"
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #0d2d2a 60%, #0a1f1e 100%)',
          boxShadow: '0 -8px 60px rgba(13,124,102,0.35), 0 0 0 1px rgba(13,124,102,0.2)',
          animation: 'slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #0d7c66, #06b6d4, #0d7c66)' }} />

        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #0d7c66, #059669)' }}
            >
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Có phiên bản mới</h2>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-xs text-slate-400 line-through">{release.currentVersion}</span>
                <span className="text-xs text-slate-500">→</span>
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

        <div
          className="mx-6 mb-4 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: 'rgba(13,124,102,0.12)', border: '1px solid rgba(13,124,102,0.2)' }}
        >
          <ExternalLink className="h-4 w-4 flex-shrink-0" style={{ color: '#0d7c66' }} />
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-300">Phát hành ngày {formatDate(release.publishedAt)}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {release.isAndroid ? 'APK sẽ được tải trực tiếp và mở màn cài đặt' : 'Release này chưa có file APK đính kèm'}
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: 'rgba(13,124,102,0.25)', color: '#34d399' }}
          >
            {release.tagName}
          </span>
        </div>

        {statusMessage && (
          <div className="mx-6 mb-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-4 py-3 text-xs leading-6 text-emerald-100">
            {statusMessage}
          </div>
        )}

        {downloadStatus !== 'idle' && downloadStatus !== 'failed' && totalBytes > 0 && (
          <div className="mx-6 mb-4">
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))}%` }}
              />
            </div>
            <div className="mt-2 text-right text-[11px] text-slate-400">{progressText}</div>
          </div>
        )}

        {release.releaseNotes && release.releaseNotes !== 'Không có ghi chú phiên bản.' && (
          <div className="mx-6 mb-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Ghi chú phiên bản
            </p>
            <div
              className="rounded-xl p-4 text-xs text-slate-300 leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <pre className="whitespace-pre-wrap font-sans">{notes}</pre>
            </div>
          </div>
        )}

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-xl py-3 text-sm font-semibold text-slate-400 transition-all"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            Để sau
          </button>
          <button
            onClick={downloadStatus === 'successful' ? handleOpenInstaller : handleUpdate}
            disabled={isBusy || downloadStatus === 'running' || downloadStatus === 'pending' || downloadStatus === 'paused'}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-70"
            style={{
              background: 'linear-gradient(135deg, #0d7c66 0%, #059669 100%)',
              boxShadow: '0 4px 20px rgba(13,124,102,0.4)',
            }}
          >
            {isBusy || downloadStatus === 'running' || downloadStatus === 'pending' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {primaryLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 640px) {
          @keyframes slideUp {
            from { transform: scale(0.9) translateY(20px); opacity: 0; }
            to   { transform: scale(1) translateY(0); opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
};
