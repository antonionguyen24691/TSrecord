import React, { useEffect, useState } from 'react';
import {
  Check,
  Download,
  FileDown,
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
  buildWordHtml,
  downloadBlobFile,
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
  const docFileName = `${fileName || 'session'}.doc`;
  const reportFileName = `${fileName || 'session'}-report.md`;
  const transcriptFileName = `${fileName || 'session'}-transcript.txt`;

  const handleDownloadTranscript = () => {
    downloadTextFile({
      content: analysis.artifacts.transcript,
      fileName: transcriptFileName,
    });
  };

  const handleDownloadMarkdownReport = () => {
    downloadTextFile({
      content: reportText,
      fileName: reportFileName,
      mimeType: 'text/markdown;charset=utf-8',
    });
  };

  const handleDownloadDoc = () => {
    const sourceHTML = buildWordHtml(analysis.title, reportText);
    const file = new Blob(['\ufeff', sourceHTML], {
      type: 'application/msword',
    });

    downloadBlobFile({
      blob: file,
      fileName: docFileName,
    });
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
      const shareFileName = `${fileName || 'session'}-report.doc`;
      const fileContent = buildWordHtml(analysis.title, reportText);

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

    handleDownloadDoc();

    const subject = encodeURIComponent(`[AI Session] ${analysis.title}`);
    const summaryBody =
      reportText.length < 1500
        ? reportText
        : `${reportText.slice(0, 1500)}\n\n[... đã cắt bớt, xem file đính kèm .doc]`;

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
                ? 'Package lưu ra sẽ gồm transcript, summary, folder tree, mindmap, metadata và bản report tổng hợp.'
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
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">.doc</span>
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">.txt</span>
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">.md</span>
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">metadata.json</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={handleDownloadDoc}
                className="rounded-[26px] border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#0d7c66] hover:shadow-lg hover:shadow-[#0d7c66]/10"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0d7c66]/10 text-[#0d7c66]">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="mt-4 text-lg font-bold text-slate-900">Tải bản Word</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Xuất report tổng hợp thành file Word để gửi nhanh cho người khác.
                </p>
              </button>

              <button
                type="button"
                onClick={handleDownloadTranscript}
                className="rounded-[26px] border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Download className="h-6 w-6" />
                </div>
                <div className="mt-4 text-lg font-bold text-slate-900">Tải transcript</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Lấy nhanh phần transcript thô để tiếp tục biên tập bên ngoài.
                </p>
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdownReport}
                className="rounded-[26px] border border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/60"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <FileDown className="h-6 w-6" />
                </div>
                <div className="mt-4 text-lg font-bold text-slate-900">Tải report Markdown</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Xuất toàn bộ phiên ở định dạng markdown để nhập vào wiki hoặc Git.
                </p>
              </button>
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
              Thao tác này sẽ tạo cây thư mục hệ thống thực tế cho phiên làm việc, sau đó ghi
              từng artifact vào các file riêng để bạn quản lý dài hạn.
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
