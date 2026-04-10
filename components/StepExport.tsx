import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  Download,
  FileCode2,
  FileImage,
  FileText,
  FolderArchive,
  Mail,
  RotateCcw,
  Share2,
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

  const handleDownloadTranscript = () => {
    downloadTextFile({
      content: analysis.artifacts.transcript,
      fileName: transcriptFileName,
    });
  };

  const handleDownloadHtmlReport = () => {
    downloadHtmlReport({
      analysis,
      fileName: htmlFileName,
    });
  };

  const handleDownloadDocx = async () => {
    try {
      setDocxStatus('building');
      await downloadDocxReport({
        analysis,
        fileName: fileName || 'session',
      });
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
      await downloadPresentationDeck({
        analysis,
        preferredBaseName: fileName,
      });
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

    handleDownloadHtmlReport();

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
      <div className="w-full rounded-[32px] border border-white/60 bg-white/90 p-6 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66]">
              Xuất dữ liệu
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-900">
              Lưu transcript hoặc đóng gói cả phiên làm việc
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              {isMeeting
                ? 'Package lưu ra sẽ gồm transcript, summary, decisions, risks, folder tree, mindmap, metadata và bản report tổng hợp.'
                : isTranscriptionOnly
                  ? 'Package lưu ra sẽ tập trung vào transcript, metadata và report tổng hợp của file đã nhập.'
                  : 'Package lưu ra sẽ gọn hơn và tập trung vào transcript phỏng vấn cùng metadata phiên ghi.'}
            </p>

            <div className="mt-8 rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                Tên gói xuất
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                className="mt-3 h-14 w-full rounded-2xl border border-transparent bg-white px-4 text-lg font-bold text-slate-900 outline-none transition-all focus:border-[#0d7c66]"
                placeholder="meeting_session_2026_03_29"
              />
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">.docx</span>
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">.html</span>
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">.pptx</span>
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">.txt</span>
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">metadata.json</span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-stretch">
              <button
                type="button"
                onClick={handleDownloadDocx}
                disabled={docxStatus === 'building'}
                className="flex-[1.5] rounded-[26px] border border-blue-200 bg-blue-50/50 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 disabled:cursor-wait disabled:opacity-70"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-200">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-950">
                      {docxStatus === 'building' ? 'Đang tạo Word...' : 'Tải file Word (.docx)'}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-blue-800">
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
                  className="flex h-full min-h-[90px] w-full items-center justify-center gap-2 rounded-[26px] border border-slate-200 bg-white px-6 font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 hover:shadow-md focus:outline-none"
                >
                  <span className="text-center">Định dạng<br />khác</span>
                  <ChevronDown className={`h-5 w-5 opacity-70 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 sm:right-0 sm:left-auto top-[100%] mt-3 w-64 z-20 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl animate-fade-in">
                    <button
                      onClick={() => handleDownloadHtmlReport()}
                      className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#0d7c66]/10 text-[#0d7c66]">
                        <FileCode2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">HTML Report</div>
                        <div className="text-xs mt-0.5 text-slate-500">Giữ nguyên bố cục web</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDownloadPptx()}
                      disabled={pptxStatus === 'building'}
                      className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600">
                        <FileImage className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Slide PPTX</div>
                        <div className="text-xs mt-0.5 text-slate-500">Tạo slide thuyết trình</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDownloadTranscript()}
                      className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600">
                        <Download className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Transcript thô</div>
                        <div className="text-xs mt-0.5 text-slate-500">File text nguyên bản</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] bg-slate-950 p-6 text-white">
            <div className="flex items-center gap-3 text-[#7af2d1]">
              <FolderArchive className="h-5 w-5" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.32em]">
                Package lưu trữ
              </span>
            </div>

            <h3 className="mt-4 text-2xl font-black">Lưu toàn bộ phiên xuống thiết bị</h3>
            <p className="mt-3 text-sm leading-6 text-white/68">
              Mọi dữ liệu đã được <b>tự động lưu</b> vào thư mục <b>Documents/TSrecord</b>. Bạn có thể nhấn nút dưới đây để tạo lại cấu trúc thư mục hoặc chia sẻ thủ công nếu cần.
            </p>

            <button
              type="button"
              onClick={handleSavePackage}
              disabled={packageStatus === 'saving'}
              className={`mt-6 inline-flex h-14 w-full items-center justify-center gap-3 rounded-2xl font-bold uppercase tracking-[0.2em] transition-all ${
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
              <p className="mt-4 break-all rounded-2xl bg-white/[0.06] px-4 py-4 font-mono text-xs text-white/72">
                {savedPackagePath}
              </p>
            )}

            {analysis.savedRecording?.path && (
              <p className="mt-4 break-all rounded-2xl bg-white/[0.06] px-4 py-4 font-mono text-xs text-white/72">
                File ghi âm gốc: {analysis.savedRecording.path}
              </p>
            )}

            {isNative ? (
              <div className="mt-6 border-t border-white/10 pt-6">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-white/[0.09]"
                >
                  <Share2 className="h-5 w-5" />
                  Chia sẻ report nhanh
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendEmail} className="mt-6 border-t border-white/10 pt-6">
                <label className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                  Gửi nhanh qua email
                </label>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-14 flex-grow rounded-2xl border border-transparent bg-white text-slate-900 outline-none px-4 font-medium"
                    placeholder="ten@congty.com"
                    required
                  />
                  <button
                    type="submit"
                    className="h-14 rounded-2xl bg-[#7af2d1] px-5 font-bold uppercase tracking-[0.2em] text-slate-950"
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
        className="mt-8 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-500 transition-all hover:border-slate-300 hover:text-slate-900"
      >
        <RotateCcw className="h-4 w-4" />
        Làm mới quy trình
      </button>
    </div>
  );
};
