import React from 'react';
import { ArrowRight, FileAudio, Mic, Sparkles } from 'lucide-react';
import { AppModule } from '../types';

interface ModuleHomeProps {
  onSelect: (module: AppModule) => void;
}

const modules = [
  {
    id: AppModule.TRANSCRIBE,
    title: 'Trích xuất ghi âm',
    description:
      'Nhập file audio/video có sẵn để lấy transcript sạch, có thể chọn timeline hoặc văn bản liền mạch.',
    bullets: ['Upload file có sẵn', 'Chỉ tập trung transcript', 'Phù hợp xử lý hậu kỳ'],
    icon: FileAudio,
  },
  {
    id: AppModule.RECORD_NOTES,
    title: 'Ghi âm & ghi chú',
    description:
      'Ghi âm trực tiếp trên thiết bị rồi sinh ghi chú theo cuộc họp hoặc chỉ chép lại nếu là phỏng vấn.',
    bullets: ['Ghi âm trực tiếp', 'Meeting notes / interview transcript', 'Lưu file và package phiên'],
    icon: Mic,
  },
];

export const ModuleHome: React.FC<ModuleHomeProps> = ({ onSelect }) => {
  return (
    <div className="animate-fade-in">
      <section className="rounded-[40px] border border-white/60 bg-white/80 p-6 md:p-8 shadow-[0_28px_90px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#0d7c66]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#0d7c66]">
            <Sparkles className="h-4 w-4" />
            TSrecord
          </div>
          <h2 className="mt-5 text-4xl font-black tracking-tight text-slate-950">
            Ghi âm, trích xuất transcript và tạo ghi chú bằng AI
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-500">
            TSrecord là ứng dụng ghi âm và xử lý nội dung âm thanh theo phong cách hiện đại:
            gọn, nhanh, trực quan và đủ sâu cho công việc thực tế. Bạn có thể trích xuất
            transcript từ file có sẵn, ghi âm trực tiếp trên thiết bị, và chuyển nội dung
            thành ghi chú cuộc họp hoặc bản chép phỏng vấn chỉ trong vài bước.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 xl:grid-cols-2">
          {modules.map((item) => {
            const Icon = item.icon;
            const darkCard = item.id === AppModule.RECORD_NOTES;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`group rounded-[32px] border p-6 text-left transition-all hover:-translate-y-1 ${
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

                <div className="mt-8 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-3xl font-black leading-tight">{item.title}</h3>
                    <p
                      className={`mt-4 text-sm leading-7 ${
                        darkCard ? 'text-white/72' : 'text-slate-600'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                  <ArrowRight
                    className={`mt-1 h-6 w-6 transition-transform group-hover:translate-x-1 ${
                      darkCard ? 'text-[#7af2d1]' : 'text-[#0d7c66]'
                    }`}
                  />
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                  {item.bullets.map((bullet) => (
                    <span
                      key={bullet}
                      className={`rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] ${
                        darkCard
                          ? 'border border-white/10 bg-white/[0.06] text-white/82'
                          : 'border border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {bullet}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
