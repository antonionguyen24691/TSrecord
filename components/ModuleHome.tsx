import React from 'react';
import { ArrowRight, FileAudio, FolderSearch, Mic, Scissors, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppModule } from '../types';

interface ModuleHomeProps {
  onSelect: (module: AppModule) => void;
  onOpenWorkspace: () => void;
  sessionCount: number;
  recentSessionTitle?: string;
}

const modules = [
  {
    id: AppModule.TRANSCRIBE,
    icon: FileAudio,
  },
  {
    id: AppModule.RECORD_NOTES,
    icon: Mic,
  },
  {
    id: AppModule.AUDIO_EDITOR,
    icon: Scissors,
  },
];

export const ModuleHome: React.FC<ModuleHomeProps> = ({
  onSelect,
  onOpenWorkspace,
  sessionCount,
  recentSessionTitle,
}) => {
  const { t } = useTranslation();
  const editorTitle = t('ModuleHome.modules.editor.title');
  const editorDesc = t('ModuleHome.modules.editor.desc');

  return (
    <div className="animate-fade-in">
      <section className="rounded-[24px] sm:rounded-[30px] border border-white/60 bg-white/85 p-3 sm:p-4 md:rounded-[40px] md:p-8 shadow-[0_18px_48px_rgba(15,23,42,0.09)] backdrop-blur-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#0d7c66]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#0d7c66]">
            <Sparkles className="h-4 w-4" />
            {t('ModuleHome.tag')}
          </div>
          <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl font-black tracking-tight text-slate-950 md:text-4xl">
            {t('ModuleHome.heroTitle')}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            {t('ModuleHome.heroDesc')}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span className="rounded-full bg-white px-3 py-2 shadow-sm">{t('ModuleHome.features.directRecord')}</span>
            <span className="rounded-full bg-white px-3 py-2 shadow-sm">{t('ModuleHome.features.upload')}</span>
            <span className="rounded-full bg-white px-3 py-2 shadow-sm">{t('ModuleHome.features.mindmap')}</span>
            <span className="rounded-full bg-white px-3 py-2 shadow-sm">{t('ModuleHome.features.export')}</span>
          </div>
        </div>

        <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3 md:mt-8 md:gap-5">
          {modules.map((item) => {
            const Icon = item.icon;
            const darkCard = item.id === AppModule.RECORD_NOTES;
            const title =
              item.id === AppModule.TRANSCRIBE
                ? t('ModuleHome.modules.transcribe.title')
                : item.id === AppModule.RECORD_NOTES
                  ? t('ModuleHome.modules.record.title')
                  : editorTitle === 'ModuleHome.modules.editor.title'
                    ? 'Audio Editor'
                    : editorTitle;
            const description =
              item.id === AppModule.TRANSCRIBE
                ? t('ModuleHome.modules.transcribe.desc')
                : item.id === AppModule.RECORD_NOTES
                  ? t('ModuleHome.modules.record.desc')
                  : editorDesc === 'ModuleHome.modules.editor.desc'
                    ? 'Trim audio before sending it to transcription'
                    : editorDesc;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`group rounded-[20px] sm:rounded-[24px] border p-3 sm:p-4 text-left transition-all hover:-translate-y-1 md:rounded-[32px] md:p-6 ${
                  darkCard
                    ? 'border-slate-900/60 bg-[linear-gradient(145deg,#0d7c66,#090b1a_52%,#040611)] text-white shadow-[0_28px_90px_rgba(2,6,23,0.35)]'
                    : 'border-slate-200 bg-[linear-gradient(145deg,#dff7ef,#ffffff_55%,#eef7ff)] text-slate-950 shadow-[0_28px_70px_rgba(13,124,102,0.12)]'
                }`}
              >
                <div
                  className={`flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl ${
                    darkCard ? 'bg-white/12 text-white' : 'bg-white text-[#0d7c66]'
                  }`}
                >
                  <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
                </div>

                <div className="mt-3 sm:mt-4 flex items-start justify-between gap-3 sm:gap-4 md:mt-8">
                  <div>
                    <h3 className="text-lg sm:text-xl font-black leading-tight md:text-3xl">{title}</h3>
                    <p
                      className={`mt-1 text-[11px] sm:text-xs leading-5 md:mt-3 md:text-sm md:leading-7 text-justify ${
                        darkCard ? 'text-white/72' : 'text-slate-600'
                      }`}
                    >
                      {description}
                    </p>
                  </div>
                  <ArrowRight
                    className={`mt-1 h-5 w-5 transition-transform group-hover:translate-x-1 md:h-6 md:w-6 ${
                      darkCard ? 'text-[#7af2d1]' : 'text-[#0d7c66]'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenWorkspace}
          className="mt-4 sm:mt-5 w-full rounded-[20px] border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#f9fffc_55%,#eef6ff)] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#0d7c66]/30 md:mt-6 md:rounded-[28px] md:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0d7c66]/10 text-[#0d7c66]">
                <FolderSearch className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0d7c66]">
                  {t('ModuleHome.workspace.badge')}
                </div>
                <h3 className="mt-2 text-lg font-black text-slate-950 md:text-2xl">
                  {t('ModuleHome.workspace.title')}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {sessionCount > 0
                    ? t('ModuleHome.workspace.descWithCount', {
                        count: sessionCount,
                        recentSessionTitle: recentSessionTitle
                          ? t('ModuleHome.workspace.recentPrefix') + recentSessionTitle + '.'
                          : '',
                      })
                    : t('ModuleHome.workspace.descEmpty')}
                </p>
              </div>
            </div>
            <ArrowRight className="mt-1 h-5 w-5 text-[#0d7c66]" />
          </div>
        </button>
      </section>
    </div>
  );
};
