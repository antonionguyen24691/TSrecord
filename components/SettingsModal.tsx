import React, { useEffect, useState } from 'react';
import { X, Save, Key, Bot, Sparkles, Zap, ChevronDown } from 'lucide-react';
import {
  DEFAULT_ANALYSIS_MODEL_ID,
  DEFAULT_REALTIME_MODE,
  DEFAULT_REALTIME_MODEL_ID,
  DEFAULT_TRANSCRIPTION_PROVIDER,
  RealtimeMode,
  TranscriptionProvider,
  clearAiApiKey,
  loadAiSettings,
  saveAiSettings,
} from '../services/aiSettingsService';
import { clearAppStorage } from '../services/sessionPackageService';
import { HardDrive, Trash2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite Preview' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Khuyên dùng — Cân bằng)' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite (Tiết kiệm chi phí nhất)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Phân tích sâu nhất)' },
];

const REALTIME_MODES: Array<{ id: RealtimeMode; name: string; description: string }> = [
  {
    id: 'HYBRID',
    name: 'Hybrid (Khuyên dùng)',
    description:
      'Realtime chỉ cập nhật transcript và summary ngắn. Decisions/risks/action items chạy đầy đủ ở bước cuối.',
  },
  {
    id: 'FULL',
    name: 'Full Realtime',
    description: 'Mỗi chunk đều gọi AI cập nhật đầy đủ. Tiện lợi nhưng tốn nhiều request hơn.',
  },
  {
    id: 'OFF',
    name: 'Tắt Realtime',
    description: 'Không gọi AI khi đang ghi âm. Chỉ phân tích 1 lần sau khi dừng ghi.',
  },
];

interface ProviderInfo {
  id: TranscriptionProvider;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  keyUrl?: string;
  keyPlaceholder: string;
  limit?: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'MIỄN PHÍ',
    badgeColor: '#16a34a',
    description: 'Multimodal — Xử lý audio trực tiếp, không giới hạn kích thước file (đến 300MB). Khuyến nghị cho hầu hết trường hợp.',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIza...',
    limit: '1500 req/ngày miễn phí',
  },
  {
    id: 'assemblyai',
    name: 'AssemblyAI',
    badge: '$50 FREE',
    badgeColor: '#2563eb',
    description: 'Chuyên biệt STT — speaker diarization, không giới hạn file. Tốt cho phân biệt nhiều người nói.',
    keyUrl: 'https://www.assemblyai.com/dashboard/signup',
    keyPlaceholder: 'Nhập AssemblyAI API Key...',
    limit: '≈333 giờ audio miễn phí',
  },
  {
    id: 'groq',
    name: 'Groq Whisper',
    badge: 'MIỄN PHÍ',
    badgeColor: '#7c3aed',
    description: 'Siêu tốc — nhanh hơn thời gian thực. Giới hạn file 25MB. Phù hợp cho file nhỏ, cần tốc độ.',
    keyUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    limit: 'Giới hạn RPM, file ≤25MB',
  },
  {
    id: 'openai',
    name: 'OpenAI Whisper',
    badge: 'TRẢ PHÍ',
    badgeColor: '#dc2626',
    description: 'Chuẩn vàng ngành — độ chính xác cao. Không có free tier, $0.006/phút audio. File ≤25MB.',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-...',
    limit: '$0.006/phút, file ≤25MB',
  },
];

/** Helper: lấy giá trị key của provider đang chọn */
const getProviderKey = (
  provider: TranscriptionProvider,
  geminiKey: string,
  assemblyaiKey: string,
  groqKey: string,
  openaiKey: string
): string => {
  if (provider === 'gemini') return geminiKey;
  if (provider === 'assemblyai') return assemblyaiKey;
  if (provider === 'groq') return groqKey;
  return openaiKey;
};

const setProviderKey = (
  provider: TranscriptionProvider,
  value: string,
  setGeminiKey: (v: string) => void,
  setAssemblyaiKey: (v: string) => void,
  setGroqKey: (v: string) => void,
  setOpenaiKey: (v: string) => void
) => {
  if (provider === 'gemini') setGeminiKey(value);
  else if (provider === 'assemblyai') setAssemblyaiKey(value);
  else if (provider === 'groq') setGroqKey(value);
  else setOpenaiKey(value);
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [assemblyaiApiKey, setAssemblyaiApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [realtimeModelId, setRealtimeModelId] = useState(DEFAULT_REALTIME_MODEL_ID);
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL_ID);
  const [realtimeMode, setRealtimeMode] = useState<RealtimeMode>(DEFAULT_REALTIME_MODE);
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>(
    DEFAULT_TRANSCRIPTION_PROVIDER
  );
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'provider' | 'gemini' | 'realtime' | 'storage'>('provider');

  useEffect(() => {
    let active = true;
    if (isOpen) {
      loadAiSettings().then((settings) => {
        if (!active) return;
        setApiKey(settings.apiKey);
        setAssemblyaiApiKey(settings.assemblyaiApiKey);
        setGroqApiKey(settings.groqApiKey);
        setOpenaiApiKey(settings.openaiApiKey);
        setRealtimeModelId(settings.realtimeModelId);
        setAnalysisModelId(settings.analysisModelId);
        setRealtimeMode(settings.realtimeMode);
        setTranscriptionProvider(settings.transcriptionProvider);
      });
    }
    return () => { active = false; };
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    await saveAiSettings({
      apiKey,
      realtimeModelId,
      analysisModelId,
      realtimeMode,
      transcriptionProvider,
      assemblyaiApiKey,
      groqApiKey,
      openaiApiKey,
    });
    setIsSaving(false);
    onClose();
  };

  const handleClearKey = async () => {
    setIsSaving(true);
    await clearAiApiKey();
    setApiKey('');
    setIsSaving(false);
  };

  if (!isOpen) return null;

  const selectedProvider = PROVIDERS.find((p) => p.id === transcriptionProvider)!;
  const currentKey = getProviderKey(
    transcriptionProvider,
    apiKey,
    assemblyaiApiKey,
    groqApiKey,
    openaiApiKey
  );

  const tabBtnCls = (tab: typeof activeTab) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
      activeTab === tab
        ? 'bg-[#006b68] text-white shadow-sm'
        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
    }`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-6 py-4 flex-shrink-0">
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#006b68] text-white">
              <Bot className="h-5 w-5" />
            </span>
            Cài đặt AI
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 pb-2 flex-shrink-0">
          <button className={tabBtnCls('provider')} onClick={() => setActiveTab('provider')}>
            Nguồn Transcript
          </button>
          <button className={tabBtnCls('gemini')} onClick={() => setActiveTab('gemini')}>
            Mô hình Gemini
          </button>
          <button className={tabBtnCls('realtime')} onClick={() => setActiveTab('realtime')}>
            Realtime
          </button>
          <button className={tabBtnCls('storage')} onClick={() => setActiveTab('storage')}>
            Bộ nhớ
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 pt-2 space-y-5">

          {/* ─── Tab: Provider ──────────────────────────────────────── */}
          {activeTab === 'provider' && (
            <>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Zap className="h-4 w-4 text-[#006b68]" />
                  Nguồn nhận diện giọng nói (STT)
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setTranscriptionProvider(p.id)}
                      className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                        transcriptionProvider === p.id
                          ? 'border-[#006b68] bg-[#006b68]/5'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 transition-all ${
                          transcriptionProvider === p.id
                            ? 'border-[#006b68] bg-[#006b68]'
                            : 'border-gray-300'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800 text-sm">{p.name}</span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                            style={{ backgroundColor: p.badgeColor }}
                          >
                            {p.badge}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{p.description}</p>
                        {p.limit && (
                          <p className="mt-1 text-[11px] font-medium" style={{ color: p.badgeColor }}>
                            {p.limit}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Key input cho provider đang chọn */}
              <div className="space-y-2 rounded-xl bg-gray-50 p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Key className="h-4 w-4 text-[#006b68]" />
                  API Key — {selectedProvider.name}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={currentKey}
                    onChange={(e) =>
                      setProviderKey(
                        transcriptionProvider,
                        e.target.value,
                        setApiKey,
                        setAssemblyaiApiKey,
                        setGroqApiKey,
                        setOpenaiApiKey
                      )
                    }
                    placeholder={selectedProvider.keyPlaceholder}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-12 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-[#006b68]"
                  >
                    {showKey ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
                {selectedProvider.keyUrl && (
                  <p className="text-xs text-gray-500">
                    Key được lưu cục bộ trên thiết bị.{' '}
                    <a
                      href={selectedProvider.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#006b68] hover:underline font-medium"
                    >
                      Lấy key tại đây →
                    </a>
                  </p>
                )}
              </div>

              {/* Gemini Key luôn cần thiết (dùng cho Bước 2 phân tích) */}
              {transcriptionProvider !== 'gemini' && (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <Bot className="h-4 w-4" />
                    Gemini API Key (bắt buộc cho phân tích)
                  </label>
                  <p className="text-xs text-amber-700">
                    Dù dùng provider nào để nhận diện giọng nói, Gemini vẫn được dùng để phân tích nội dung (Summary, Mindmap, v.v.). Vui lòng nhập Gemini API Key nếu chưa có.
                  </p>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIza..."
                      className="w-full rounded-lg border border-amber-300 bg-white px-4 py-3 pr-12 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-amber-600 hover:text-amber-800"
                    >
                      {showKey ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-medium text-amber-700 hover:underline"
                  >
                    Lấy Gemini Key tại đây →
                  </a>
                </div>
              )}
            </>
          )}

          {/* ─── Tab: Mô hình Gemini ────────────────────────────────── */}
          {activeTab === 'gemini' && (
            <>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Bot className="h-4 w-4 text-[#006b68]" />
                  Model cho Realtime ghi âm
                </label>
                <div className="relative">
                  <select
                    value={realtimeModelId}
                    onChange={(e) => setRealtimeModelId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                  >
                    {AVAILABLE_GEMINI_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Khuyến nghị: <b>Gemini 2.5 Flash-Lite</b> — thấp chi phí, độ trễ thấp.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Bot className="h-4 w-4 text-[#006b68]" />
                  Model cho Phân tích cuối
                </label>
                <div className="relative">
                  <select
                    value={analysisModelId}
                    onChange={(e) => setAnalysisModelId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                  >
                    {AVAILABLE_GEMINI_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Khuyến nghị: <b>Gemini 2.5 Flash</b> — cân bằng tốc độ và chất lượng.
                  Cần độ sâu cao hơn thì chọn <b>2.5 Pro</b>.
                </p>
              </div>
            </>
          )}

          {/* ─── Tab: Realtime ───────────────────────────────────────── */}
          {activeTab === 'realtime' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Sparkles className="h-4 w-4 text-[#006b68]" />
                Chế độ Realtime
              </label>
              <div className="grid grid-cols-1 gap-2">
                {REALTIME_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setRealtimeMode(mode.id)}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      realtimeMode === mode.id
                        ? 'border-[#006b68] bg-[#006b68]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 transition-all ${
                        realtimeMode === mode.id
                          ? 'border-[#006b68] bg-[#006b68]'
                          : 'border-gray-300'
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{mode.name}</p>
                      <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{mode.description}</p>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 pt-1">
                * Chế độ Realtime chỉ dùng Google Gemini bất kể cài đặt nguồn transcript ở trên.
              </p>
            </div>
          )}

          {/* ─── Tab: Bộ nhớ ────────────────────────────────────────── */}
          {activeTab === 'storage' && (
            <div className="space-y-6">
              <div className="space-y-3 rounded-xl bg-gray-50 p-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <HardDrive className="h-4 w-4 text-[#006b68]" />
                  Vị trí lưu trữ cục bộ
                </label>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <code className="text-xs font-mono text-gray-600 break-all">
                    Documents/TSrecord
                  </code>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Tất cả file ghi âm, transcript và bản phân tích được lưu tại thư mục này trong bộ nhớ máy của bạn. Bạn có thể truy cập qua ứng dụng Quản lý file trên Android.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-rose-100 bg-rose-50/50 p-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                  <Trash2 className="h-4 w-4" />
                  Khu vực nguy hiểm
                </label>
                <p className="text-xs text-rose-700">
                  Hành động này sẽ xóa vĩnh viễn toàn bộ thư mục <b>TSrecord</b>, bao gồm tất cả các bản ghi âm và kết quả đã lưu. Hành động này không thể hoàn tác.
                </p>
                <button
                  onClick={async () => {
                    const ok = window.confirm(
                      'CẢNH BÁO: Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu ứng dụng (file ghi âm, transcript...) không? Hành động này không thể hoàn tác.'
                    );
                    if (ok) {
                      setIsSaving(true);
                      try {
                        await clearAppStorage();
                        alert('Đã xóa toàn bộ dữ liệu thành công.');
                      } catch (err: any) {
                        alert('Lỗi khi xóa dữ liệu: ' + err.message);
                      } finally {
                        setIsSaving(false);
                      }
                    }
                  }}
                  disabled={isSaving}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa toàn bộ dữ liệu
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-white px-6 py-4 flex justify-end gap-3 flex-shrink-0">
          {transcriptionProvider === 'gemini' && (
            <button
              onClick={handleClearKey}
              disabled={isSaving || !apiKey.trim()}
              className="rounded-lg px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
            >
              Xóa key Gemini
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            Đóng
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-[#006b68] px-6 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-[#005553] hover:shadow-lg disabled:cursor-wait disabled:bg-[#7ca89f]"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </div>
  );
};
