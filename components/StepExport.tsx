import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileCode2,
  FileImage,
  FileText,
  FolderArchive,
  Mail,
  RotateCcw,
  Share2,
  X,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { SessionAnalysis, SessionContext } from '../types';
import {
  buildCombinedReport,
  buildPresentationHtml,
  downloadHtmlReport,
  downloadPresentationDeck,
  downloadDocxReport,
  downloadTextFile,
  saveSessionPackage,
} from '../services/sessionPackageService';
import { getAppStorageLabel, getLegacyStorageLabel } from '../services/storagePaths';

interface StepExportProps {
  analysis: SessionAnalysis;
  fileName: string;
  setFileName: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
  onReset: () => void;
  originalFileName?: string;
}

export const StepExport: React.FC<StepExportProps> = ({
  analysis,
  fileName,
  setFileName,
  email,
  setEmail,
  onReset,
  originalFileName,
}) => {
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [packageStatus, setPackageStatus] = useState<'idle' | 'saving' | 'success' | 'error'>(
    'idle'
  );
  const [savedPackagePath, setSavedPackagePath] = useState<string>('');
  const [lastExportPath, setLastExportPath] = useState<string>('');
  const [lastExportName, setLastExportName] = useState<string>('');
  const [lastExportUri, setLastExportUri] = useState<string>('');
  const [showExportToast, setShowExportToast] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!fileName) {
      const baseName = (
        analysis.suggestedFolderName ||
        analysis.title ||
        originalFileName ||
        'session'
      )
        .replace(/\.[^.]+$/, '')
        .replace(/\s+/g, '_');

      setFileName(baseName);
    }
  }, [analysis, fileName, originalFileName, setFileName]);

  const reportText = buildCombinedReport(analysis);
  const isMeeting = analysis.context === SessionContext.MEETING;
  const isTranscriptionOnly = analysis.context === SessionContext.TRANSCRIPTION;
  const htmlFileName = `${fileName || 'session'}-report.html`;
  const [pptxStatus, setPptxStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle');
  const [docxStatus, setDocxStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle');
  const transcriptFileName = `${fileName || 'session'}-transcript.txt`;

  // ── Toast helpers ──────────────────────────────────────────────
  const showSuccessToast = (savedFile: any) => {
    if (savedFile?.path) {
      setLastExportPath(savedFile.directoryLabel || savedFile.path);
      setLastExportName(savedFile.fileName || '');
      setLastExportUri(savedFile.uri || '');
      setShowExportToast(true);
    }
  };

  const dismissToast = () => setShowExportToast(false);

  const handleOpenExportedFile = async () => {
    if (!lastExportUri) return;
    try {
      await Share.share({
        title: lastExportName,
        url: lastExportUri,
        dialogTitle: 'Mở file với...',
      });
    } catch (err) {
      console.error('Open file failed:', err);
    }
  };

  // ── Download handlers ─────────────────────────────────────────
  const handleDownloadTranscript = async () => {
    const savedFile = await downloadTextFile({
      content: analysis.artifacts.transcript,
      fileName: transcriptFileName,
    });
    showSuccessToast(savedFile);
  };

  const handleDownloadHtmlReport = async () => {
    const savedFile = await downloadHtmlReport({
      analysis,
      fileName: htmlFileName,
    });
    showSuccessToast(savedFile);
  };

  const handleDownloadDocx = async () => {
    try {
      setDocxStatus('building');
      const savedFile = await downloadDocxReport({
        analysis,
        fileName: fileName || 'session',
      });
      showSuccessToast(savedFile);
      setDocxStatus('success');
      window.setTimeout(() => setDocxStatus('idle'), 1800);
    } catch (error) {
      console.error('DOCX export failed:', error);
      setDocxStatus('error');
      alert(`Không thể tạo file Word: ${error}`);
      window.setTimeout(() => setDocxStatus('idle'), 1800);
    }
  };

  const handleDownloadPptx = async () => {
    try {
      setPptxStatus('building');
      const savedFile = await downloadPresentationDeck({
        analysis,
        preferredBaseName: fileName,
      });
      showSuccessToast(savedFile);
      setPptxStatus('success');
      window.setTimeout(() => setPptxStatus('idle'), 1800);
    } catch (error) {
      console.error('PPTX export failed:', error);
      setPptxStatus('error');
      alert(`Không thể tạo file PPTX: ${error}`);
      window.setTimeout(() => setPptxStatus('idle'), 1800);
    }
  };

  const handleSavePackage = async () => {
    try {
      setPackageStatus('saving');
      const savedPackage = await saveSessionPackage({
        analysis,
        preferredBaseName: fileName,
      });

      setSavedPackagePath(savedPackage.path);
      setPackageStatus('success');
    } catch (error) {
      console.error('Save package failed:', error);
      setPackageStatus('error');
      alert(`Không thể lưu trọn bộ phiên: ${error}`);
    }
  };

  const handleNativeShare = async () => {
    try {
      const shareFileName = `${fileName || 'session'}-report.html`;
      const fileContent = buildPresentationHtml(analysis);

      const result = await Filesystem.writeFile({
        path: shareFileName,
        data: fileContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      await Share.share({
        title: analysis.title,
        text:
          analysis.context === SessionContext.MEETING
            ? 'Biên bản cuộc họp và các artifact AI đính kèm.'
            : analysis.context === SessionContext.TRANSCRIPTION
              ? 'Transcript trích xuất từ file đính kèm.'
            : 'Transcript phỏng vấn đính kèm.',
        url: result.uri,
        dialogTitle: 'Chia sẻ kết quả',
      });
    } catch (error) {
      console.error('Share failed:', error);
      alert(`Không thể chia sẻ file: ${error}`);
    }
  };

  const handleSendEmail = (event: React.FormEvent) => {
    event.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    void handleDownloadHtmlReport();

    const subject = encodeURIComponent(`[AI Session] ${analysis.title}`);
    const summaryBody =
      reportText.length < 1500
        ? reportText
        : `${reportText.slice(0, 1500)}\n\n[... Da cat bot, xem file HTML report da tai]`;

    const mailtoLink = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(
      summaryBody
    )}`;

    window.location.href = mailtoLink;
    setEmailStatus('success');
    window.setTimeout(() => setEmailStatus('idle'), 3000);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl animate-fade-in pb-10">
      <div className="w-full rounded-[24px] sm:rounded-[32px] border border-white/60 bg-white/90 p-4 sm:p-6 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-5 sm:gap-6">
          <div>
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66]">
              Xuất dữ liệu
            </p>
            <h2 className="mt-2 sm:mt-3 text-xl sm:text-2xl md:text-3xl font-black text-slate-900">
              Xuất trọn bộ biên bản, mindmap và file Word/PPT
            </h2>
            <p className="mt-2 sm:mt-3 max-w-2xl text-xs sm:text-sm leading-5 sm:leading-6 text-slate-500 text-justify">
              {isMeeting
                ? 'Package lưu ra sẽ gồm transcript, summary, decisions, risks, action items, folder tree, mindmap, metadata và bản report tổng hợp.'
                : isTranscriptionOnly
                  ? 'Package lưu ra sẽ tập trung vào transcript, metadata và report tổng hợp của file đã nhập để bạn tiếp tục dùng trong Word hoặc chia sẻ nhanh.'
                  : 'Package lưu ra sẽ gọn hơn và tập trung vào transcript phỏng vấn cùng metadata phiên ghi để bạn dễ tra cứu và mở lại sau này.'}
            </p>

            <div className="mt-5 sm:mt-8 rounded-[20px] sm:rounded-[28px] border border-slate-200 bg-slate-50 p-4 sm:p-6">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                Tên gói xuất
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                className="mt-3 h-12 sm:h-14 w-full rounded-2xl border border-transparent bg-white px-4 text-base sm:text-lg font-bold text-slate-900 outline-none transition-all focus:border-[#0d7c66]"
                placeholder="meeting_session_2026_03_29"
              />
              <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-slate-500">
                <span className="rounded-full bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm">.docx</span>
                <span className="rounded-full bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm">.html</span>
                <span className="rounded-full bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm">.pptx</span>
                <span className="rounded-full bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm">.txt</span>
                <span className="rounded-full bg-white px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm">metadata.json</span>
              </div>
            </div>

            <div className="mt-4 sm:mt-6 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-stretch">
              <button
                type="button"
                onClick={handleDownloadDocx}
                disabled={docxStatus === 'building'}
                className="flex-[1.5] rounded-[20px] sm:rounded-[26px] border border-blue-200 bg-blue-50/50 p-4 sm:p-5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 disabled:cursor-wait disabled:opacity-70"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-200">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div>
                    <div className="text-base sm:text-lg font-bold text-blue-950">
                      {docxStatus === 'building' ? 'Đang tạo Word...' : 'Tải file Word (.docx)'}
                    </div>
                    <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm leading-5 sm:leading-6 text-blue-800 text-justify">
                      Định dạng ưu tiên, nội dung đầy đủ và dễ dàng chỉnh sửa.
                    </p>
                  </div>
                </div>
              </button>

              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                  className="flex h-full min-h-[80px] sm:min-h-[90px] w-full items-center justify-center gap-2 rounded-[20px] sm:rounded-[26px] border border-slate-200 bg-white px-5 sm:px-6 font-semibold text-sm sm:text-base text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus:outline-none"
                >
                  <span className="text-center">Định dạng<br />khác</span>
                  <ChevronDown className={`h-4 w-4 sm:h-5 sm:w-5 opacity-70 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 sm:right-0 sm:left-auto top-[100%] mt-3 w-60 sm:w-64 z-20 rounded-xl sm:rounded-2xl border border-slate-100 bg-white p-2 shadow-xl animate-fade-in">
                    <button
                      onClick={() => handleDownloadHtmlReport()}
                      className="flex w-full items-center gap-3 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-[10px] bg-[#0d7c66]/10 text-[#0d7c66]">
                        <FileCode2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">HTML Report</div>
                        <div className="text-[11px] sm:text-xs mt-0.5 text-slate-500">Giữ nguyên bố cục web</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDownloadPptx()}
                      disabled={pptxStatus === 'building'}
                      className="flex w-full items-center gap-3 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-[10px] bg-indigo-50 text-indigo-600">
                        <FileImage className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">Slide PPTX</div>
                        <div className="text-[11px] sm:text-xs mt-0.5 text-slate-500">Tạo slide thuyết trình</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDownloadTranscript()}
                      className="flex w-full items-center gap-3 rounded-lg sm:rounded-xl p-2.5 sm:p-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-[10px] bg-slate-100 text-slate-600">
                        <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900">Transcript thô</div>
                        <div className="text-[11px] sm:text-xs mt-0.5 text-slate-500">File text nguyên bản</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] sm:rounded-[32px] bg-slate-950 p-4 sm:p-6 text-white">
            <div className="flex items-center gap-3 text-[#7af2d1]">
              <FolderArchive className="h-5 w-5" />
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.32em]">
                Package lưu trữ
              </span>
            </div>

            <h3 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-black">Lưu toàn bộ phiên xuống thiết bị</h3>
            <p className="mt-2 sm:mt-3 text-xs sm:text-sm leading-5 sm:leading-6 text-white/68 text-justify">
              Mọi dữ liệu đã được <b>tự động lưu</b> vào <b>{getAppStorageLabel()}</b> để ứng dụng mở lại và xóa ổn định hơn. Khi cần chia sẻ ra ngoài, app sẽ tạo file export riêng trong thư mục công khai. Dữ liệu cũ ở <b>{getLegacyStorageLabel()}</b> chỉ còn được giữ để dọn chuyển tiếp nếu máy vẫn còn.
            </p>

            <button
              type="button"
              onClick={handleSavePackage}
              disabled={packageStatus === 'saving'}
              className={`mt-4 sm:mt-6 inline-flex h-12 sm:h-14 w-full items-center justify-center gap-3 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold uppercase tracking-[0.2em] transition-all ${
                packageStatus === 'saving'
                  ? 'cursor-wait bg-white/10 text-white/60'
                  : 'bg-[#7af2d1] text-slate-950 hover:-translate-y-0.5'
              }`}
            >
              {packageStatus === 'success' ? (
                <>
                  <Check className="h-5 w-5" />
                  Đã lưu package
                </>
              ) : packageStatus === 'saving' ? (
                'Đang lưu package...'
              ) : (
                <>
                  <FolderArchive className="h-5 w-5" />
                  Lưu trọn bộ phiên
                </>
              )}
            </button>

            {savedPackagePath && (
              <p className="mt-4 break-all rounded-xl sm:rounded-2xl bg-white/[0.06] px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-xs text-white/72">
                {savedPackagePath}
              </p>
            )}

            {/* ── Export success toast ───────────────────────────────── */}
            {showExportToast && lastExportPath && (
              <div className="mt-4 animate-toast-in rounded-xl sm:rounded-2xl border border-emerald-400/30 bg-emerald-950/80 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                    <div className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400/20">
                      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-emerald-200">✅ Tải thành công!</p>
                      <p className="mt-1 break-all font-mono text-[10px] sm:text-xs text-emerald-300/70">
                        File được lưu tại: {lastExportPath}/{lastExportName}
                      </p>
                      {isNative && lastExportUri && (
                        <button
                          type="button"
                          onClick={handleOpenExportedFile}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/20 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/30"
                        >
                          <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          Mở file ngay
                        </button>
                      )}
                    </div>
                  </div>
                  <button onClick={dismissToast} className="shrink-0 rounded-full p-1 text-white/40 hover:text-white/70">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {analysis.savedRecording?.path && (
              <p className="mt-4 break-all rounded-xl sm:rounded-2xl bg-white/[0.06] px-3 sm:px-4 py-3 sm:py-4 font-mono text-[11px] sm:text-xs text-white/72">
                File ghi âm gốc: {analysis.savedRecording.path}
              </p>
            )}

            {isNative ? (
              <div className="mt-4 sm:mt-6 border-t border-white/10 pt-4 sm:pt-6">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex h-12 sm:h-14 w-full items-center justify-center gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.05] text-sm sm:text-base font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-white/[0.09]"
                >
                  <Share2 className="h-5 w-5" />
                  Chia sẻ report nhanh
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendEmail} className="mt-4 sm:mt-6 border-t border-white/10 pt-4 sm:pt-6">
                <label className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                  Gửi nhanh qua email
                </label>
                <div className="mt-2 sm:mt-3 flex flex-col gap-2 sm:gap-3 sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 sm:h-14 flex-grow rounded-xl sm:rounded-2xl border border-transparent bg-white text-slate-900 outline-none px-4 text-sm sm:text-base font-medium"
                    placeholder="ten@congty.com"
                    required
                  />
                  <button
                    type="submit"
                    className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-[#7af2d1] px-4 sm:px-5 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-slate-950"
                  >
                    <span className="inline-flex items-center gap-2">
                      {emailStatus === 'success' ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Mail className="h-5 w-5" />
                      )}
                      {emailStatus === 'success' ? 'Đã mở email' : 'Gửi email'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 sm:mt-8 inline-flex items-center gap-2 sm:gap-3 rounded-full border border-slate-200 bg-white px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-slate-500 transition-all hover:border-slate-300 hover:text-slate-900"
      >
        <RotateCcw className="h-4 w-4" />
        Làm mới quy trình
      </button>
    </div>
  );
};
