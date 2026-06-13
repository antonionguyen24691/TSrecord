import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, Key, Bot, Sparkles, Zap, ChevronDown, CreditCard, ShieldCheck, Ticket, Copy, Check } from 'lucide-react';
import {
  DEFAULT_AUTO_GAIN_LEVEL,
  DEFAULT_ANALYSIS_MODEL_ID,
  DEFAULT_CHUNK_DURATION_MINUTES,
  DEFAULT_MACRO_BATCH_MINUTES,
  DEFAULT_CHUNK_CONCURRENCY,
  DEFAULT_CHUNK_STAGGER_SECONDS,
  DEFAULT_ECHO_CANCELLATION_LEVEL,
  DEFAULT_NOISE_SUPPRESSION_LEVEL,
  DEFAULT_PREFERRED_CHANNEL_COUNT,
  DEFAULT_PREFERRED_SAMPLE_RATE,
  DEFAULT_REALTIME_MODE,
  DEFAULT_REALTIME_MODEL_ID,
  DEFAULT_RECORDING_PROFILE,
  DEFAULT_TRANSCRIPTION_PROVIDER,
  DEFAULT_USE_ADMIN_KEY,
  PreferredChannelCount,
  PreferredSampleRate,
  ProcessingStrength,
  RealtimeMode,
  RecordingProfile,
  TranscriptionProvider,
  clearAiApiKey,
  loadAiSettings,
  saveAiSettings,
  getDeviceId,
  checkLicenseStatus,
  redeemPromoCode,
  getPaymentInfo,
  LicenseInfo,
} from '../services/aiSettingsService';
import { clearAppStorage } from '../services/sessionPackageService';
import { getAppStorageLabel, getLegacyStorageLabel } from '../services/storagePaths';
import { HardDrive, Trash2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStorageCleared?: () => void | Promise<void>;
}

const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-3-flash-preview' },
  { id: 'gemini-3-pro-preview' },
  { id: 'gemini-3.1-flash-lite-preview' },
  { id: 'gemini-2.5-flash' },
  { id: 'gemini-2.5-flash-lite' },
  { id: 'gemini-2.5-pro' },
];

const REALTIME_MODES: Array<{ id: RealtimeMode }> = [
  { id: 'HYBRID' },
  { id: 'FULL' },
  { id: 'OFF' },
];

const RECORDING_PROFILES: Array<{
  id: RecordingProfile;
}> = [
  { id: 'BALANCED' },
  { id: 'VOICE_FOCUS' },
  { id: 'NOISY_ENV' },
  { id: 'RAW' },
  { id: 'CUSTOM' },
];

const PROCESSING_LEVELS: Array<{ id: ProcessingStrength }> = [
  { id: 'OFF' },
  { id: 'LOW' },
  { id: 'MEDIUM' },
  { id: 'HIGH' },
];

const SAMPLE_RATE_OPTIONS: Array<{ id: PreferredSampleRate; name: string }> = [
  { id: 16000, name: '16 kHz' },
  { id: 24000, name: '24 kHz' },
  { id: 44100, name: '44.1 kHz' },
  { id: 48000, name: '48 kHz' },
];

const CHANNEL_OPTIONS: Array<{ id: PreferredChannelCount; name: string }> = [
  { id: 1, name: 'Mono' },
  { id: 2, name: 'Stereo' },
];

const RECORDING_PROFILE_PRESETS: Record<
  Exclude<RecordingProfile, 'CUSTOM'>,
  {
    noiseSuppressionLevel: ProcessingStrength;
    echoCancellationLevel: ProcessingStrength;
    autoGainLevel: ProcessingStrength;
    preferredSampleRate: PreferredSampleRate;
    preferredChannelCount: PreferredChannelCount;
  }
> = {
  BALANCED: {
    noiseSuppressionLevel: 'MEDIUM',
    echoCancellationLevel: 'MEDIUM',
    autoGainLevel: 'LOW',
    preferredSampleRate: 48000,
    preferredChannelCount: 1,
  },
  VOICE_FOCUS: {
    noiseSuppressionLevel: 'HIGH',
    echoCancellationLevel: 'MEDIUM',
    autoGainLevel: 'MEDIUM',
    preferredSampleRate: 48000,
    preferredChannelCount: 1,
  },
  NOISY_ENV: {
    noiseSuppressionLevel: 'HIGH',
    echoCancellationLevel: 'HIGH',
    autoGainLevel: 'HIGH',
    preferredSampleRate: 24000,
    preferredChannelCount: 1,
  },
  RAW: {
    noiseSuppressionLevel: 'OFF',
    echoCancellationLevel: 'OFF',
    autoGainLevel: 'OFF',
    preferredSampleRate: 48000,
    preferredChannelCount: 2,
  },
};

interface ProviderInfo {
  id: TranscriptionProvider;
  badgeColor: string;
  keyUrl?: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    badgeColor: '#16a34a',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'assemblyai',
    badgeColor: '#2563eb',
    keyUrl: 'https://www.assemblyai.com/dashboard/signup',
  },
  {
    id: 'groq',
    badgeColor: '#0d7c66',
    keyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openai',
    badgeColor: '#dc2626',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
];

/** Helper: get the stored key for the active provider. */
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

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onStorageCleared,
}) => {
  const { t, i18n } = useTranslation();
  const [apiKey, setApiKey] = useState('');
  const [assemblyaiApiKey, setAssemblyaiApiKey] = useState('');
  const [groqApiKey, setGroqApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [realtimeModelId, setRealtimeModelId] = useState(DEFAULT_REALTIME_MODEL_ID);
  const [analysisModelId, setAnalysisModelId] = useState(DEFAULT_ANALYSIS_MODEL_ID);
  const [realtimeMode, setRealtimeMode] = useState<RealtimeMode>(DEFAULT_REALTIME_MODE);
  const [recordingProfile, setRecordingProfile] = useState<RecordingProfile>(DEFAULT_RECORDING_PROFILE);
  const [noiseSuppressionLevel, setNoiseSuppressionLevel] = useState<ProcessingStrength>(
    DEFAULT_NOISE_SUPPRESSION_LEVEL
  );
  const [echoCancellationLevel, setEchoCancellationLevel] = useState<ProcessingStrength>(
    DEFAULT_ECHO_CANCELLATION_LEVEL
  );
  const [autoGainLevel, setAutoGainLevel] = useState<ProcessingStrength>(DEFAULT_AUTO_GAIN_LEVEL);
  const [preferredSampleRate, setPreferredSampleRate] = useState<PreferredSampleRate>(
    DEFAULT_PREFERRED_SAMPLE_RATE
  );
  const [preferredChannelCount, setPreferredChannelCount] = useState<PreferredChannelCount>(
    DEFAULT_PREFERRED_CHANNEL_COUNT
  );
  const [chunkDurationMinutes, setChunkDurationMinutes] = useState(DEFAULT_CHUNK_DURATION_MINUTES);
  const [macroBatchMinutes, setMacroBatchMinutes] = useState(DEFAULT_MACRO_BATCH_MINUTES);
  const [chunkStaggerSeconds, setChunkStaggerSeconds] = useState(DEFAULT_CHUNK_STAGGER_SECONDS);
  const [chunkConcurrency, setChunkConcurrency] = useState(DEFAULT_CHUNK_CONCURRENCY);
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>(
    DEFAULT_TRANSCRIPTION_PROVIDER
  );
  const [useAdminKey, setUseAdminKey] = useState(DEFAULT_USE_ADMIN_KEY);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  
  // Licensing & Payment States
  const [deviceId, setDeviceIdState] = useState('');
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [promoMessage, setPromoMessage] = useState('');
  const [promoError, setPromoError] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [pricingMode, setPricingMode] = useState<'adminKey' | 'ownKey'>('adminKey');
  const [selectedPlan, setSelectedPlan] = useState<'monthly_20' | 'monthly_50' | 'monthly_100'>('monthly_20');
  const [selectedOwnKeyPlan, setSelectedOwnKeyPlan] = useState<'own_key_ads' | 'own_key_no_ads' | 'disable_ads'>('own_key_ads');
  const [selectedDuration, setSelectedDuration] = useState<1 | 3 | 6 | 12>(1);
  const [paymentGateway, setPaymentGateway] = useState<'vietqr' | 'stripe'>('vietqr');
  const [stripeLoading, setStripeLoading] = useState(false);
  const [sepayOrder, setSepayOrder] = useState<{
    qrUrl?: string;
    transferContent?: string;
    accountName?: string;
    amountMinor?: number;
  } | null>(null);

  const resolvePlanKey = () =>
    pricingMode === 'adminKey' ? selectedPlan : selectedOwnKeyPlan;

  const handleStripeCheckout = async () => {
    setStripeLoading(true);
    try {
      const { createV2Order } = await import('../services/backendClient');
      const data = await createV2Order(resolvePlanKey(), 'stripe');
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
      } else {
        throw new Error('Không nhận được checkout URL.');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi thanh toán Stripe.');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleCreateSepayOrder = async () => {
    try {
      const { createV2Order } = await import('../services/backendClient');
      const data = await createV2Order(resolvePlanKey(), 'sepay');
      setSepayOrder(data);
    } catch (err: any) {
      alert(err.message || 'Không thể tạo mã chuyển khoản.');
    }
  };

  useEffect(() => {
    setSepayOrder(null);
  }, [pricingMode, selectedPlan, selectedOwnKeyPlan, paymentGateway]);

  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'provider' | 'gemini' | 'chunking' | 'realtime' | 'recording' | 'storage' | 'license' | 'google-drive'
  >('provider');

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
        setRecordingProfile(settings.recordingProfile);
        setNoiseSuppressionLevel(settings.noiseSuppressionLevel);
        setEchoCancellationLevel(settings.echoCancellationLevel);
        setAutoGainLevel(settings.autoGainLevel);
        setPreferredSampleRate(settings.preferredSampleRate);
        setPreferredChannelCount(settings.preferredChannelCount);
        setChunkDurationMinutes(settings.chunkDurationMinutes);
        setMacroBatchMinutes(settings.macroBatchMinutes);
        setChunkStaggerSeconds(settings.chunkStaggerSeconds);
        setChunkConcurrency(settings.chunkConcurrency);
        setTranscriptionProvider(settings.transcriptionProvider);
        setUseAdminKey(settings.useAdminKey);
        setGoogleClientId(settings.googleClientId || '');
        setGoogleApiKey(settings.googleApiKey || '');
      });

      getDeviceId().then((id) => {
        if (active) setDeviceIdState(id);
      });
      checkLicenseStatus().then((status) => {
        if (active) setLicenseInfo(status);
      });
      getPaymentInfo().then((info) => {
        if (active) setPaymentInfo(info);
      });
    }
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    if (licenseInfo && !licenseInfo.features.includes('system_api_key') && useAdminKey) {
      setUseAdminKey(false);
    }
  }, [licenseInfo, useAdminKey]);

  const canUseAdminKey = licenseInfo?.features.includes('system_api_key') ?? false;
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
      recordingProfile,
      noiseSuppressionLevel,
      echoCancellationLevel,
      autoGainLevel,
      preferredSampleRate,
      preferredChannelCount,
      chunkDurationMinutes,
      macroBatchMinutes,
      chunkStaggerSeconds,
      chunkConcurrency,
      useAdminKey: canUseAdminKey ? useAdminKey : false,
      googleClientId,
      googleApiKey,
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

  const language = i18n.resolvedLanguage || i18n.language;
  const dateLocale =
    language.startsWith('zh') ? 'zh-CN' : language.startsWith('ko') ? 'ko-KR' : language.startsWith('en') ? 'en-US' : 'vi-VN';

  const geminiModels = AVAILABLE_GEMINI_MODELS.map((model) => ({
    ...model,
    name: t(`SettingsModal.models.options.${model.id}`),
  }));
  const realtimeModes = REALTIME_MODES.map((mode) => ({
    ...mode,
    name: t(`SettingsModal.realtime.options.${mode.id}.name`),
    description: t(`SettingsModal.realtime.options.${mode.id}.description`),
  }));
  const recordingProfiles = RECORDING_PROFILES.map((profile) => ({
    ...profile,
    name: t(`SettingsModal.recording.profiles.options.${profile.id}.name`),
    description: t(`SettingsModal.recording.profiles.options.${profile.id}.description`),
  }));
  const processingLevels = PROCESSING_LEVELS.map((level) => ({
    ...level,
    name: t(`SettingsModal.recording.advanced.processingLevels.${level.id}`),
  }));
  const providers = PROVIDERS.map((provider) => ({
    ...provider,
    name: t(`SettingsModal.provider.options.${provider.id}.name`),
    badge: t(`SettingsModal.provider.options.${provider.id}.badge`),
    description: t(`SettingsModal.provider.options.${provider.id}.description`),
    keyPlaceholder: t(`SettingsModal.provider.options.${provider.id}.keyPlaceholder`),
    limit: t(`SettingsModal.provider.options.${provider.id}.limit`),
  }));

  const selectedProvider = providers.find((p) => p.id === transcriptionProvider)!;
  const currentKey = getProviderKey(
    transcriptionProvider,
    apiKey,
    assemblyaiApiKey,
    groqApiKey,
    openaiApiKey
  );

  const tabBtnCls = (tab: typeof activeTab) =>
    `flex-shrink-0 whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
      activeTab === tab
        ? 'bg-[#006b68] text-white shadow-sm'
        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
    }`;

  const applyRecordingProfile = (profile: RecordingProfile) => {
    setRecordingProfile(profile);
    if (profile === 'CUSTOM') return;
    const preset = RECORDING_PROFILE_PRESETS[profile];
    setNoiseSuppressionLevel(preset.noiseSuppressionLevel);
    setEchoCancellationLevel(preset.echoCancellationLevel);
    setAutoGainLevel(preset.autoGainLevel);
    setPreferredSampleRate(preset.preferredSampleRate);
    setPreferredChannelCount(preset.preferredChannelCount);
  };

  const handleManualRecordingChange = (setter: (value: any) => void, value: any) => {
    setter(value);
    setRecordingProfile('CUSTOM');
  };

  const licensePlanLabel = licenseInfo?.valid
    ? licenseInfo.plan === 'promo'
      ? t('SettingsModal.license.status.planPromo')
      : licenseInfo.plan
    : t('SettingsModal.license.status.planFree');

  const licenseExpiresLabel = licenseInfo?.expiresAt
    ? new Date(licenseInfo.expiresAt).toLocaleDateString(dateLocale)
    : t('SettingsModal.license.status.unlimited');

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh] sm:max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-800">
            <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-[#006b68] text-white">
              <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            {t('SettingsModal.title')}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="scroll-fade-right flex-shrink-0">
          <div className="thin-scrollbar px-4 sm:px-6 pt-3 sm:pt-4 pb-2">
            <div className="flex min-w-max gap-1">
              <button className={tabBtnCls('provider')} onClick={() => setActiveTab('provider')}>
                {t('SettingsModal.tabs.provider')}
              </button>
              <button className={tabBtnCls('gemini')} onClick={() => setActiveTab('gemini')}>
                {t('SettingsModal.tabs.models')}
              </button>
              <button className={tabBtnCls('chunking')} onClick={() => setActiveTab('chunking')}>
                {t('SettingsModal.tabs.chunking')}
              </button>
              <button className={tabBtnCls('realtime')} onClick={() => setActiveTab('realtime')}>
                {t('SettingsModal.tabs.realtime')}
              </button>
              <button className={tabBtnCls('recording')} onClick={() => setActiveTab('recording')}>
                {t('SettingsModal.tabs.recording')}
              </button>
              <button className={tabBtnCls('storage')} onClick={() => setActiveTab('storage')}>
                {t('SettingsModal.tabs.storage')}
              </button>
              <button className={tabBtnCls('license')} onClick={() => setActiveTab('license')}>
                {t('SettingsModal.tabs.license')}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 pb-6 pt-2 space-y-4 sm:space-y-5">

          {/* ─── Tab: Provider ──────────────────────────────────────── */}
          {activeTab === 'provider' && (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4 transition-all hover:bg-gray-50">
                <input
                  type="checkbox"
                  id="useAdminKeyCheckbox"
                  checked={useAdminKey}
                  disabled={!canUseAdminKey}
                  onChange={(e) => setUseAdminKey(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-gray-300 text-[#006b68] focus:ring-[#006b68]"
                />
                <div className="flex-1">
                  <label htmlFor="useAdminKeyCheckbox" className="text-sm font-bold text-gray-800 cursor-pointer flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-[#006b68]" />
                    {t('SettingsModal.provider.useAdminKey.title')}
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    {t('SettingsModal.provider.useAdminKey.description')}
                  </p>
                  {!canUseAdminKey && (
                    <p className="mt-1 text-[11px] font-semibold text-amber-700">
                      Thiết bị này chưa có gói hợp lệ nên chưa thể bật key admin.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Zap className="h-4 w-4 text-[#006b68]" />
                  {t('SettingsModal.provider.sourceLabel')}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {providers.map((p) => (
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

              {useAdminKey ? (
                <div className="space-y-2 rounded-xl border border-[#006b68]/20 bg-[#006b68]/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#006b68]">
                    <ShieldCheck className="h-4.5 w-4.5" />
                    {t('SettingsModal.provider.adminEnabled.title')}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {t('SettingsModal.provider.adminEnabled.description', {
                      provider: selectedProvider.name,
                      planTab: t('SettingsModal.tabs.license'),
                    })}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 rounded-xl bg-gray-50 p-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Key className="h-4 w-4 text-[#006b68]" />
                      {t('SettingsModal.provider.keyLabel', { provider: selectedProvider.name })}
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
                        {showKey ? t('SettingsModal.common.hide') : t('SettingsModal.common.show')}
                      </button>
                    </div>
                    {selectedProvider.keyUrl && (
                      <p className="text-xs text-gray-500">
                        {t('SettingsModal.provider.keyStoredLocally')}{' '}
                        <a
                          href={selectedProvider.keyUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#006b68] hover:underline font-medium"
                        >
                          {t('SettingsModal.provider.getKeyHere')}
                        </a>
                      </p>
                    )}
                  </div>

                  {transcriptionProvider !== 'gemini' && (
                    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <label className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                        <Bot className="h-4 w-4" />
                        {t('SettingsModal.provider.geminiAnalysisKey.title')}
                      </label>
                      <p className="text-xs text-amber-700">
                        {t('SettingsModal.provider.geminiAnalysisKey.description')}
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
                          {showKey ? t('SettingsModal.common.hide') : t('SettingsModal.common.show')}
                        </button>
                      </div>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs font-medium text-amber-700 hover:underline"
                      >
                        {t('SettingsModal.provider.geminiAnalysisKey.link')}
                      </a>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'gemini' && (
            <>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Bot className="h-4 w-4 text-[#006b68]" />
                  {t('SettingsModal.models.realtimeLabel')}
                </label>
                <div className="relative">
                  <select
                    value={realtimeModelId}
                    onChange={(e) => setRealtimeModelId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                  >
                    {geminiModels.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {t('SettingsModal.models.realtimeHintPrefix')} <b>Gemini 3 Flash Preview</b>{' '}
                  {t('SettingsModal.models.realtimeHintMiddle')} <b>Gemini 2.5 Flash-Lite</b>.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Bot className="h-4 w-4 text-[#006b68]" />
                  {t('SettingsModal.models.analysisLabel')}
                </label>
                <div className="relative">
                  <select
                    value={analysisModelId}
                    onChange={(e) => setAnalysisModelId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                  >
                    {geminiModels.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {t('SettingsModal.models.analysisHintPrefix')} <b>Gemini 3 Pro Preview</b>{' '}
                  {t('SettingsModal.models.analysisHintMiddle')} <b>Gemini 2.5 Flash</b>.
                </p>
              </div>
            </>
          )}

          {activeTab === 'chunking' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">{t('SettingsModal.chunking.title')}</div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  {t('SettingsModal.chunking.description')}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {t('SettingsModal.chunking.durationLabel')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={chunkDurationMinutes}
                      onChange={(event) =>
                        setChunkDurationMinutes(
                          Math.min(30, Math.max(1, Number(event.target.value) || DEFAULT_CHUNK_DURATION_MINUTES))
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                    />
                    <p className="text-xs text-gray-500">
                      {t('SettingsModal.chunking.durationHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {t('SettingsModal.chunking.macroBatchLabel')}
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={30}
                      value={macroBatchMinutes}
                      onChange={(event) =>
                        setMacroBatchMinutes(
                          Math.min(30, Math.max(5, Number(event.target.value) || DEFAULT_MACRO_BATCH_MINUTES))
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                    />
                    <p className="text-xs text-gray-500">
                      {t('SettingsModal.chunking.macroBatchHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {t('SettingsModal.chunking.staggerLabel')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={chunkStaggerSeconds}
                      onChange={(event) =>
                        setChunkStaggerSeconds(
                          Math.min(60, Math.max(0, Number(event.target.value) || 0))
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                    />
                    <p className="text-xs text-gray-500">
                      {t('SettingsModal.chunking.staggerHint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {t('SettingsModal.chunking.concurrencyLabel')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1}
                      value={chunkConcurrency}
                      onChange={() => setChunkConcurrency(1)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                      disabled
                    />
                    <p className="text-xs text-gray-500">
                      {t('SettingsModal.chunking.concurrencyHint')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Tab: Realtime ───────────────────────────────────────── */}
          {activeTab === 'realtime' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Sparkles className="h-4 w-4 text-[#006b68]" />
                {t('SettingsModal.realtime.title')}
              </label>
              <div className="grid grid-cols-1 gap-2">
                {realtimeModes.map((mode) => (
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
                {t('SettingsModal.realtime.note')}
              </p>
            </div>
          )}

          {activeTab === 'recording' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Sparkles className="h-4 w-4 text-[#006b68]" />
                  {t('SettingsModal.recording.profiles.title')}
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {recordingProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => applyRecordingProfile(profile.id)}
                      className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                        recordingProfile === profile.id
                          ? 'border-[#006b68] bg-[#006b68]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 transition-all ${
                          recordingProfile === profile.id
                            ? 'border-[#006b68] bg-[#006b68]'
                            : 'border-gray-300'
                        }`}
                      />
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{profile.name}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                          {profile.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-semibold text-gray-800">{t('SettingsModal.recording.advanced.title')}</div>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  {t('SettingsModal.recording.advanced.description')}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {t('SettingsModal.recording.advanced.noiseLabel')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {processingLevels.map((level) => (
                        <button
                          key={`noise-${level.id}`}
                          onClick={() => handleManualRecordingChange(setNoiseSuppressionLevel, level.id)}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                            noiseSuppressionLevel === level.id
                              ? 'bg-[#006b68] text-white'
                              : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {level.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {t('SettingsModal.recording.advanced.echoLabel')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {processingLevels.map((level) => (
                        <button
                          key={`echo-${level.id}`}
                          onClick={() => handleManualRecordingChange(setEchoCancellationLevel, level.id)}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                            echoCancellationLevel === level.id
                              ? 'bg-[#006b68] text-white'
                              : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {level.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {t('SettingsModal.recording.advanced.gainLabel')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {processingLevels.map((level) => (
                        <button
                          key={`gain-${level.id}`}
                          onClick={() => handleManualRecordingChange(setAutoGainLevel, level.id)}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                            autoGainLevel === level.id
                              ? 'bg-[#006b68] text-white'
                              : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {level.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                        {t('SettingsModal.recording.advanced.sampleRateLabel')}
                      </label>
                      <div className="relative">
                        <select
                          value={preferredSampleRate}
                          onChange={(e) =>
                            handleManualRecordingChange(
                              setPreferredSampleRate,
                              Number(e.target.value) as PreferredSampleRate
                            )
                          }
                          className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                        >
                          {SAMPLE_RATE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                        {t('SettingsModal.recording.advanced.channelLabel')}
                      </label>
                      <div className="relative">
                        <select
                          value={preferredChannelCount}
                          onChange={(e) =>
                            handleManualRecordingChange(
                              setPreferredChannelCount,
                              Number(e.target.value) as PreferredChannelCount
                            )
                          }
                          className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                        >
                          {CHANNEL_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-6">
              <div className="space-y-3 rounded-xl bg-gray-50 p-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <HardDrive className="h-4 w-4 text-[#006b68]" />
                  {t('SettingsModal.storage.localPathTitle')}
                </label>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <code className="text-xs font-mono text-gray-600 break-all">
                    {getAppStorageLabel()}
                  </code>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {t('SettingsModal.storage.localPathDescription')}
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-rose-100 bg-rose-50/50 p-5">
                <label className="flex items-center gap-2 text-sm font-semibold text-rose-800">
                  <Trash2 className="h-4 w-4" />
                  {t('SettingsModal.storage.dangerTitle')}
                </label>
                <p className="text-xs text-rose-700">
                  {t('SettingsModal.storage.dangerDescription', {
                    appStorage: getAppStorageLabel(),
                    legacyStorage: getLegacyStorageLabel(),
                  })}
                </p>
                <button
                  onClick={async () => {
                    const ok = window.confirm(
                      t('SettingsModal.storage.confirmDeleteAll')
                    );
                    if (ok) {
                      setIsSaving(true);
                      try {
                        await clearAppStorage();
                        await onStorageCleared?.();
                        alert(t('SettingsModal.storage.deleteSuccess'));
                      } catch (err: any) {
                        alert(t('SettingsModal.storage.deleteError', { message: err.message }));
                      } finally {
                        setIsSaving(false);
                      }
                    }
                  }}
                  disabled={isSaving}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('SettingsModal.storage.deleteAll')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'license' && (() => {
            const defaultPricing = {
              monthly_20: 39000,
              monthly_50: 59000,
              monthly_100: 99000,
              own_key_ads: 199000,
              own_key_no_ads: 248000,
              disable_ads: 49000,
            };
            const defaultDiscounts = {
              '3M': 3,
              '6M': 5,
              '12M': 8,
            };
            const pricing = paymentInfo?.pricing || defaultPricing;
            const discounts = paymentInfo?.discounts || defaultDiscounts;

            let basePrice: number;
            let planKey = '';
            if (pricingMode === 'adminKey') {
              basePrice = pricing[selectedPlan] || 0;
              planKey = selectedPlan;
            } else {
              basePrice = pricing[selectedOwnKeyPlan] || 0;
              planKey = selectedOwnKeyPlan;
            }
            const duration = pricingMode === 'adminKey' ? selectedDuration : 1;
            const rawPrice = basePrice * duration;
            let discountPercent = 0;
            if (pricingMode === 'adminKey') {
              if (duration === 3) discountPercent = discounts['3M'] || 3;
              else if (duration === 6) discountPercent = discounts['6M'] || 5;
              else if (duration === 12) discountPercent = discounts['12M'] || 8;
            }
            const finalPrice = Math.round(rawPrice * (1 - discountPercent / 100));
            const syntax = `TSRECORD ${deviceId} ${planKey.toUpperCase()} ${duration}M`;

            return (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Status card */}
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                      <ShieldCheck className="h-5 w-5 text-[#006b68]" />
                      {t('SettingsModal.license.status.title')}
                    </div>
                    <div>
                      {licenseInfo?.valid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                          {t('SettingsModal.license.status.activated')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600 border border-gray-200">
                          {t('SettingsModal.license.status.notActivated')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500 block">{t('SettingsModal.license.status.planLabel')}</span>
                      <span className="font-bold text-gray-800 mt-0.5 block capitalize font-semibold">
                        {licensePlanLabel}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">{t('SettingsModal.license.status.expiresLabel')}</span>
                      <span className="font-bold text-gray-800 mt-0.5 block font-semibold">
                        {licenseExpiresLabel}
                      </span>
                    </div>
                    {licenseInfo && typeof licenseInfo.requestsLimit === 'number' && (
                      <div className="col-span-2 border-t border-gray-100 pt-2 flex items-center justify-between">
                        <div>
                          <span className="text-gray-500 block font-semibold">Lượt xử lý (Requests):</span>
                          <span className="font-extrabold text-[#006b68] mt-0.5 block">
                            {licenseInfo.requestsUsed || 0} / {licenseInfo.requestsLimit}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-right font-semibold">Biển quảng cáo:</span>
                          <span className="font-extrabold text-gray-800 mt-0.5 block text-right">
                            {licenseInfo.adsEnabled ? 'Đang bật' : 'Đã tắt'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg bg-white border border-gray-200 p-2.5 flex items-center justify-between gap-3 text-xs mt-2 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <span className="text-gray-500 block text-[10px] uppercase font-bold tracking-wider">{t('SettingsModal.license.status.deviceIdLabel')}</span>
                      <span className="font-mono text-gray-700 break-all select-all font-bold block mt-0.5">{deviceId || t('SettingsModal.license.status.loadingDeviceId')}</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(deviceId);
                        setCopiedField('device_id');
                        setTimeout(() => setCopiedField(null), 2000);
                      }}
                      className="p-2 text-gray-500 hover:text-[#006b68] hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                      title={t('SettingsModal.license.status.copyDeviceId')}
                    >
                      {copiedField === 'device_id' ? <Check className="h-4 w-4 text-emerald-600 animate-scale" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Promo Code */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                    <Ticket className="h-5 w-5 text-[#006b68]" />
                    {t('SettingsModal.license.promo.title')}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder={t('SettingsModal.license.promo.placeholder')}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold outline-none uppercase tracking-wider focus:border-[#006b68] focus:ring-2 focus:ring-[#006b68]/20"
                    />
                    <button
                      onClick={async () => {
                        if (!promoCode.trim()) return;
                        setIsRedeeming(true);
                        setPromoMessage('');
                        setPromoError('');
                        try {
                          const res = await redeemPromoCode(promoCode);
                          if (res.ok) {
                            setPromoMessage(res.message || t('SettingsModal.license.promo.success'));
                            setPromoCode('');
                            const status = await checkLicenseStatus();
                            setLicenseInfo(status);
                          } else {
                            setPromoError(res.error || t('SettingsModal.license.promo.invalid'));
                          }
                        } catch (err: any) {
                          setPromoError(err.message || t('SettingsModal.license.promo.error'));
                        } finally {
                          setIsRedeeming(false);
                        }
                      }}
                      disabled={isRedeeming || !promoCode.trim()}
                      className="rounded-lg bg-[#006b68] px-4 py-2 text-xs font-bold text-white transition-all hover:bg-[#005553] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRedeeming ? t('SettingsModal.license.promo.submitting') : t('SettingsModal.license.promo.activate')}
                    </button>
                  </div>
                  {promoMessage && <p className="text-xs text-emerald-600 font-semibold">{promoMessage}</p>}
                  {promoError && <p className="text-xs text-rose-600 font-semibold">{promoError}</p>}
                </div>

                {/* Pricing Plans & Gateways */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-800 border-b border-gray-100 pb-2">
                    <CreditCard className="h-5 w-5 text-[#006b68]" />
                    Đăng ký & Nâng cấp Gói dịch vụ
                  </div>

                  <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPricingMode('adminKey')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                        pricingMode === 'adminKey'
                          ? 'bg-white text-gray-800 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      🚀 Sử dụng Key Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingMode('ownKey')}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                        pricingMode === 'ownKey'
                          ? 'bg-white text-gray-800 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      🔑 API Key cá nhân
                    </button>
                  </div>

                  {pricingMode === 'adminKey' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Sử dụng key AI hệ thống (không cần API Key riêng). Gói cước đã bao gồm tính năng tắt quảng cáo. <i>1 request = tối đa 30 phút audio</i>.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'monthly_20' as const, name: 'Standard', limit: '20 req/tháng', priceVal: pricing.monthly_20 },
                          { id: 'monthly_50' as const, name: 'Advanced', limit: '50 req/tháng', priceVal: pricing.monthly_50 },
                          { id: 'monthly_100' as const, name: 'Pro', limit: '100 req/tháng', priceVal: pricing.monthly_100 },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedPlan(item.id)}
                            className={`flex flex-col items-center p-2 rounded-xl border-2 transition-all text-center bg-white ${
                              selectedPlan === item.id
                                ? 'border-[#006b68] bg-[#006b68]/5 text-[#006b68] border-[#006b68]'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <span className="text-xs font-bold">{item.name}</span>
                            <span className="text-[9px] text-gray-400 mt-0.5">{item.limit}</span>
                            <span className="text-xs font-extrabold mt-1 text-gray-850">
                              {new Intl.NumberFormat('vi-VN').format(item.priceVal)}đ
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-450 uppercase tracking-wider block">Kỳ hạn thanh toán</label>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { id: 1 as const, name: '1 tháng', desc: 'Gốc' },
                            { id: 3 as const, name: '3 tháng', desc: `-${discounts['3M']}%` },
                            { id: 6 as const, name: '6 tháng', desc: `-${discounts['6M']}%` },
                            { id: 12 as const, name: '12 tháng', desc: `-${discounts['12M']}%` },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSelectedDuration(item.id)}
                              className={`flex flex-col items-center py-1 rounded-lg border text-center transition-all ${
                                selectedDuration === item.id
                                  ? 'border-[#006b68] bg-[#006b68]/5 text-[#006b68] font-bold border-2'
                                  : 'border-gray-250 bg-white text-gray-500'
                              }`}
                            >
                              <span className="text-[10px] block">{item.name}</span>
                              <span className="text-[8px] font-bold block text-emerald-600">{item.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Sử dụng API Key cá nhân của bạn (Gemini, Groq, OpenAI, AssemblyAI).
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'own_key_ads' as const, name: '🔑 Mở bản quyền tự điền Key', desc: 'Sử dụng key cá nhân, app hiển thị quảng cáo banner dưới đáy.', priceVal: pricing.own_key_ads, badge: 'TRỌN ĐỜI' },
                          { id: 'own_key_no_ads' as const, name: '✨ Bản quyền Tự điền Key + Tắt Ads', desc: 'Sử dụng key cá nhân và tắt hoàn toàn tất cả quảng cáo.', priceVal: pricing.own_key_no_ads, badge: 'TRỌN ĐỜI' },
                          { id: 'disable_ads' as const, name: '🚫 Gói Tắt quảng cáo riêng lẻ', desc: 'Chỉ tắt quảng cáo banner dưới đáy (cho user đã có bản quyền điền key).', priceVal: pricing.disable_ads, badge: 'TẬN HƯỞNG' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedOwnKeyPlan(item.id)}
                            className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all bg-white ${
                              selectedOwnKeyPlan === item.id
                                ? 'border-[#006b68] bg-[#006b68]/5 border-[#006b68]'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-800">{item.name}</span>
                                <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">{item.badge}</span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
                            </div>
                            <span className="text-xs font-extrabold text-gray-800 whitespace-nowrap self-center">
                              {new Intl.NumberFormat('vi-VN').format(item.priceVal)}đ
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary Card */}
                  <div className="border border-gray-200 bg-white rounded-xl p-3 space-y-3 shadow-inner">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-gray-450 font-bold block">TỔNG THANH TOÁN:</span>
                        <span className="text-[9px] text-gray-450 block italic">
                          {pricingMode === 'adminKey' 
                            ? `${selectedPlan.toUpperCase()} × ${selectedDuration} tháng`
                            : `${selectedOwnKeyPlan.toUpperCase()}`
                          }
                        </span>
                      </div>
                      <div className="text-right">
                        {discountPercent > 0 && (
                          <span className="text-[9px] font-bold text-emerald-600 line-through block opacity-60">
                            {new Intl.NumberFormat('vi-VN').format(rawPrice)}đ
                          </span>
                        )}
                        <span className="text-base font-black text-[#006b68]">
                          {new Intl.NumberFormat('vi-VN').format(finalPrice)}đ
                        </span>
                      </div>
                    </div>

                    {/* Gateway selection */}
                    <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2.5">
                      <button
                        type="button"
                        onClick={() => setPaymentGateway('vietqr')}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          paymentGateway === 'vietqr'
                            ? 'border-[#006b68] bg-[#006b68]/5 text-[#006b68] border-[#006b68]'
                            : 'border-gray-200 text-gray-500 hover:text-gray-700 bg-gray-50'
                        }`}
                      >
                        🏦 Chuyển khoản VietQR
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentGateway('stripe')}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          paymentGateway === 'stripe'
                            ? 'border-[#006b68] bg-[#006b68]/5 text-[#006b68] border-[#006b68]'
                            : 'border-gray-200 text-gray-500 hover:text-gray-700 bg-gray-50'
                        }`}
                      >
                        💳 Thẻ quốc tế (Stripe)
                      </button>
                    </div>

                    {/* QR code / Stripe instructions */}
                    <div className="border-t border-gray-100 pt-2.5">
                      {paymentGateway === 'vietqr' ? (
                        <div className="flex flex-col gap-3">
                          {!sepayOrder ? (
                            <button
                              type="button"
                              onClick={handleCreateSepayOrder}
                              className="rounded-xl border border-[#006b68] bg-[#006b68]/5 px-4 py-2.5 text-xs font-bold text-[#006b68] hover:bg-[#006b68]/10"
                            >
                              Tạo mã VietQR / nội dung chuyển khoản
                            </button>
                          ) : (
                            <div className="flex flex-col sm:flex-row gap-3 items-center">
                              <div className="w-24 h-24 bg-white border border-gray-200 rounded-lg p-1 flex flex-col items-center justify-center relative shadow-sm shrink-0">
                                {sepayOrder.qrUrl ? (
                                  <img
                                    src={sepayOrder.qrUrl}
                                    alt="VietQR Payment Code"
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <span className="text-[10px] text-gray-400 text-center px-1">QR chưa khả dụng</span>
                                )}
                              </div>
                              <div className="flex-1 w-full space-y-1 text-xs text-gray-600">
                                <div className="grid grid-cols-3 gap-0.5">
                                  <span className="text-gray-400">Số tiền:</span>
                                  <span className="col-span-2 font-bold text-gray-800">
                                    {(sepayOrder.amountMinor || finalPrice).toLocaleString('vi-VN')} VND
                                  </span>

                                  <span className="text-gray-400">Cú pháp CK:</span>
                                  <span className="col-span-2 font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 flex items-center justify-between gap-1">
                                    <span className="font-mono text-[9px] break-all select-all">
                                      {sepayOrder.transferContent || syntax}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(sepayOrder.transferContent || syntax);
                                        setCopiedField('memo_ck');
                                        setTimeout(() => setCopiedField(null), 2000);
                                      }}
                                      className="text-[#006b68] text-[9px] hover:underline flex-shrink-0"
                                    >
                                      {copiedField === 'memo_ck' ? 'Đã chép' : 'Copy'}
                                    </button>
                                  </span>

                                  {sepayOrder.accountName ? (
                                    <>
                                      <span className="text-gray-400">Chủ TK:</span>
                                      <span className="col-span-2 font-bold text-gray-800">{sepayOrder.accountName}</span>
                                    </>
                                  ) : null}
                                </div>
                                <p className="text-[9px] text-amber-600 bg-amber-50 p-1.5 rounded leading-normal mt-1 font-semibold">
                                  ⚠️ Chỉ ghi đúng mã đơn hàng trong nội dung chuyển khoản để kích hoạt tự động.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-2 space-y-2 text-center">
                          <p className="text-xs text-gray-500">
                            Thanh toán qua Stripe hỗ trợ thẻ tín dụng quốc tế (Visa, Mastercard, JCB).
                          </p>
                          <button
                            type="button"
                            onClick={handleStripeCheckout}
                            disabled={stripeLoading}
                            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white text-xs shadow-md transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                          >
                            {stripeLoading ? 'Đang tạo link thanh toán...' : '💳 MỞ TRANG THANH TOÁN STRIPE'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-white px-4 sm:px-6 py-3 sm:py-4 flex justify-end gap-2 sm:gap-3 flex-shrink-0">
          {transcriptionProvider === 'gemini' && (
            <button
              onClick={handleClearKey}
              disabled={isSaving || !apiKey.trim()}
              className="rounded-lg px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-rose-300"
            >
              {t('SettingsModal.clearGeminiKey')}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
          >
            {t('SettingsModal.close')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-[#006b68] px-6 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-[#005553] hover:shadow-lg disabled:cursor-wait disabled:bg-[#7ca89f]"
          >
            <Save className="h-4 w-4" />
            {isSaving ? t('SettingsModal.saving') : t('SettingsModal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
