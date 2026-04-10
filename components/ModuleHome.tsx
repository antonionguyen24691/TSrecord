import React from 'react';
import { ArrowRight, FileAudio, Mic, Sparkles } from 'lucide-react';
import { AppModule } from '../types';

interface ModuleHomeProps {
  onSelect: (module: AppModule) => void;
}

const modules = [
  {
    id: AppModule.TRANSCRIBE,
    title: 'Trích xuất',
    description: 'Upload file có sẵn',
    icon: FileAudio,
  },
  {
    id: AppModule.RECORD_NOTES,
    title: 'Ghi âm',
    description: 'Ghi trực tiếp trên thiết bị',
    icon: Mic,
  },
];

export const ModuleHome: React.FC<ModuleHomeProps> = ({ onSelect }) => {
  return (
    <div className="animate-fade-in">
      <section className="rounded-[30px] border border-white/60 bg-white/85 p-4 md:rounded-[40px] md:p-8 shadow-[0_18px_48px_rgba(15,23,42,0.09)] backdrop-blur-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#0d7c66]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#0d7c66]">
            <Sparkles className="h-4 w-4" />
            TSrecord
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950 md:text-4xl">
            Chọn module
          </h2>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:mt-8 md:gap-5">
          {modules.map((item) => {
            const Icon = item.icon;
            const darkCard = item.id === AppModule.RECORD_NOTES;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`group rounded-[24px] border p-4 text-left transition-all hover:-translate-y-1 md:rounded-[32px] md:p-6 ${
                  darkCard
                    ? 'border-slate-900/60 bg-[linear-gradient(145deg,#0d7c66,#090b1a_52%,#040611)] text-white shadow-[0_28px_90px_rgba(2,6,23,0.35)]'
                    : 'border-slate-200 bg-[linear-gradient(145deg,#dff7ef,#ffffff_55%,#eef7ff)] text-slate-950 shadow-[0_28px_70px_rgba(13,124,102,0.12)]'
                }`}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                    darkCard ? 'bg-white/12 text-white' : 'bg-white text-[#0d7c66]'
                  }`}
                >
                  <Icon className="h-7 w-7" />
                </div>

                <div className="mt-4 flex items-start justify-between gap-4 md:mt-8">
                  <div>
                    <h3 className="text-xl font-black leading-tight md:text-3xl">{item.title}</h3>
                    <p
                      className={`mt-1 text-xs leading-5 md:mt-3 md:text-sm md:leading-7 ${
                        darkCard ? 'text-white/72' : 'text-slate-600'
                      }`}
                    >
                      {item.description}
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
      </section>
    </div>
  );
};
