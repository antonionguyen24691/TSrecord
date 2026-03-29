import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  FolderTree,
  ListTodo,
  ScrollText,
  Share2,
} from 'lucide-react';
import { ArtifactKey, SessionAnalysis, SessionContext } from '../types';

interface StepResultProps {
  analysis: SessionAnalysis;
  setAnalysis: React.Dispatch<React.SetStateAction<SessionAnalysis | null>>;
  onNext: () => void;
}

export const StepResult: React.FC<StepResultProps> = ({
  analysis,
  setAnalysis,
  onNext,
}) => {
  const contextLabel =
    analysis.context === SessionContext.MEETING
      ? 'Meeting'
      : analysis.context === SessionContext.INTERVIEW
        ? 'Interview'
        : 'Transcription';

  const [copied, setCopied] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactKey>('transcript');

  const artifactItems = useMemo(
    () =>
      [
        {
          key: 'transcript' as ArtifactKey,
          label: 'Transcript',
          description: 'Bản chép lời chính.',
          icon: ScrollText,
          content: analysis.artifacts.transcript,
        },
        ...(analysis.context === SessionContext.MEETING
          ? [
              {
                key: 'summary' as ArtifactKey,
                label: 'Summary',
                description: 'Tóm tắt cuộc họp.',
                icon: Share2,
                content: analysis.artifacts.summary,
              },
              {
                key: 'folderTree' as ArtifactKey,
                label: 'Folder tree',
                description: 'Cây thư mục đề xuất.',
                icon: FolderTree,
                content: analysis.artifacts.folderTree,
              },
              {
                key: 'mindmap' as ArtifactKey,
                label: 'Mindmap',
                description: 'Mindmap hệ thống.',
                icon: FolderTree,
                content: analysis.artifacts.mindmap,
              },
              {
                key: 'actionItems' as ArtifactKey,
                label: 'Action items',
                description: 'Checklist công việc.',
                icon: ListTodo,
                content: analysis.artifacts.actionItems,
              },
            ]
          : []),
      ],
    [analysis]
  );

  useEffect(() => {
    if (!artifactItems.some((item) => item.key === selectedArtifact)) {
      setSelectedArtifact('transcript');
    }
  }, [artifactItems, selectedArtifact]);

  const activeArtifact =
    artifactItems.find((item) => item.key === selectedArtifact) || artifactItems[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeArtifact.content || '');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const updateArtifact = (key: ArtifactKey, value: string) => {
    setAnalysis((current) => {
      if (!current) return current;

      return {
        ...current,
        artifacts: {
          ...current.artifacts,
          [key]: value,
        },
      };
    });
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl animate-fade-in">
      <div className="w-full rounded-[32px] border border-white/60 bg-white/90 p-6 md:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#0d7c66]">
              Kết quả AI
            </p>
            <input
              type="text"
              value={analysis.title}
              onChange={(event) =>
                setAnalysis((current) =>
                  current
                    ? {
                        ...current,
                        title: event.target.value,
                      }
                    : current
                )
              }
              className="mt-3 w-full rounded-2xl border border-transparent bg-slate-50 px-4 py-3 text-3xl font-black text-slate-900 outline-none transition-all focus:border-[#0d7c66] focus:bg-white"
            />
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Bạn có thể chỉnh trực tiếp từng artifact trước khi xuất file hoặc lưu trọn bộ
              phiên làm việc xuống thiết bị.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-[20px] bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Context
              </div>
              <div className="mt-2 font-bold text-slate-900">{contextLabel}</div>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Source
              </div>
              <div className="mt-2 font-bold text-slate-900">
                {analysis.source === 'RECORDING' ? 'Recording' : 'Upload'}
              </div>
            </div>
            <div className="rounded-[20px] bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Artifacts
              </div>
              <div className="mt-2 font-bold text-slate-900">{artifactItems.length}</div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-5">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-4 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7af2d1]">
              Artifact editor
            </div>
            <div className="mt-4 space-y-3">
              {artifactItems.map((item) => {
                const Icon = item.icon;
                const active = item.key === selectedArtifact;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedArtifact(item.key)}
                    className={`w-full rounded-[22px] border p-4 text-left transition-all ${
                      active
                        ? 'border-[#7af2d1] bg-white/10'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                          active ? 'bg-[#7af2d1] text-slate-950' : 'bg-white/10 text-white'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-white">{item.label}</div>
                        <div className="mt-1 text-xs text-white/60">{item.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900">{activeArtifact.label}</div>
                <div className="text-xs text-slate-500">{activeArtifact.description}</div>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  copied
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Đã sao chép' : 'Sao chép phần này'}
              </button>
            </div>

            <textarea
              value={activeArtifact.content}
              onChange={(event) => updateArtifact(activeArtifact.key, event.target.value)}
              className="min-h-[60vh] w-full resize-none bg-white px-5 py-5 font-mono text-sm leading-7 text-slate-800 outline-none"
              placeholder="Nội dung sẽ hiển thị tại đây..."
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex w-full max-w-6xl justify-center">
          <button
            onClick={onNext}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#0d7c66] px-6 text-base font-bold uppercase tracking-[0.2em] text-white shadow-lg shadow-[#0d7c66]/25 transition-all hover:-translate-y-0.5 md:w-auto md:min-w-[320px]"
          >
            Sang bước xuất
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="h-24 md:hidden" />
    </div>
  );
};
