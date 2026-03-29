import React, { useEffect, useState } from 'react';
import { X, Save, Key, Bot } from 'lucide-react';
import {
    DEFAULT_MODEL_ID,
    clearAiApiKey,
    loadAiSettings,
    saveAiSettings,
} from '../services/aiSettingsService';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AVAILABLE_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Default)' },
    { id: 'gemini-3.0-flash-preview', name: 'Gemini 3.0 Flash Preview' },
    { id: 'gemini-3.0-pro-preview', name: 'Gemini 3.0 Pro Preview' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Experimental' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [apiKey, setApiKey] = useState('');
    const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
    const [showKey, setShowKey] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let active = true;

        if (isOpen) {
            loadAiSettings().then((settings) => {
                if (!active) return;
                setApiKey(settings.apiKey);
                setModelId(settings.modelId);
            });
        }

        return () => {
            active = false;
        };
    }, [isOpen]);

    const handleSave = async () => {
        setIsSaving(true);
        await saveAiSettings({ apiKey, modelId });
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-[#006b68] text-white flex items-center justify-center">
                            <Bot className="w-5 h-5" />
                        </span>
                        Cài đặt hệ thống
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* API Key Input */}
                    <div className="space-y-3">
                        <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Key className="w-4 h-4 text-[#006b68]" />
                            Google Gemini API Key
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Nhập API Key bắt đầu bằng AIza..."
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#006b68] focus:border-[#006b68] outline-none transition-all pr-12 text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-[#006b68]"
                            >
                                {showKey ? "Ẩn" : "Hiện"}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Key chỉ được lưu cục bộ trên thiết bị này. Bản app phát hành không cần nhúng sẵn API key.
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[#006b68] hover:underline ml-1">Lấy key tại đây</a>
                        </p>
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-3">
                        <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Bot className="w-4 h-4 text-[#006b68]" />
                            Chọn Model AI
                        </label>
                        <div className="relative">
                            <select
                                value={modelId}
                                onChange={(e) => setModelId(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#006b68] focus:border-[#006b68] outline-none transition-all appearance-none text-sm bg-white"
                            >
                                {AVAILABLE_MODELS.map(model => (
                                    <option key={model.id} value={model.id}>{model.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            * Khuyên dùng <b>Gemini 2.0 Flash Exp</b> cho tốc độ và chất lượng tiếng Việt tốt nhất hiện nay.
                        </p>
                    </div>

                </div>

                {/* Author Info */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-500 font-medium">
                        Developed by <span className="text-[#006b68] font-bold">Antonio Nguyen</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                        Zalo: <span className="font-mono text-gray-600">0936389010</span>
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={handleClearKey}
                        disabled={isSaving || !apiKey.trim()}
                        className="px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:text-rose-300"
                    >
                        Xóa key
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Đóng
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2 text-sm font-bold text-white bg-[#006b68] hover:bg-[#005553] rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:cursor-wait disabled:bg-[#7ca89f]"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
                    </button>
                </div>
            </div>
        </div>
    );
};
