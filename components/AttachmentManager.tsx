import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudUpload, FileText, X, AlertTriangle } from 'lucide-react';

interface AttachmentManagerProps {
  additionalFiles: File[];
  setAdditionalFiles: (files: File[]) => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
};

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
  additionalFiles,
  setAdditionalFiles,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleFiles = (files: FileList) => {
    const validExtensions = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.md'];
    const newFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (validExtensions.includes(ext)) {
        // Tránh trùng lặp file cùng tên và dung lượng
        if (!additionalFiles.some((f) => f.name === file.name && f.size === file.size)) {
          newFiles.push(file);
        }
      } else {
        alert(t('AttachmentManager.unsupportedFileAlert', { name: file.name }));
      }
    }

    if (newFiles.length > 0) {
      setAdditionalFiles([...additionalFiles, ...newFiles]);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (event.dataTransfer.files) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleFiles(event.target.files);
    }
  };

  const removeFile = (index: number) => {
    const updated = [...additionalFiles];
    updated.splice(index, 1);
    setAdditionalFiles(updated);
  };

  // Kiểm tra xem có file nào có định dạng cũ (.doc, .ppt) hay không
  const hasLegacyFiles = additionalFiles.some((f) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    return ext === 'doc' || ext === 'ppt';
  });

  // Chọn màu sắc/icon đại diện dựa theo đuôi tệp
  const getFileStyle = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return {
          iconColor: 'text-red-500 bg-red-50',
          borderColor: 'border-red-100 hover:border-red-300',
        };
      case 'docx':
      case 'doc':
        return {
          iconColor: 'text-blue-500 bg-blue-50',
          borderColor: 'border-blue-100 hover:border-blue-300',
        };
      case 'pptx':
      case 'ppt':
        return {
          iconColor: 'text-orange-500 bg-orange-50',
          borderColor: 'border-orange-100 hover:border-orange-300',
        };
      case 'txt':
      case 'md':
        return {
          iconColor: 'text-slate-500 bg-slate-50',
          borderColor: 'border-slate-100 hover:border-slate-300',
        };
      default:
        return {
          iconColor: 'text-emerald-500 bg-emerald-50',
          borderColor: 'border-emerald-100 hover:border-emerald-300',
        };
    }
  };

  return (
    <div className="w-full mt-6 border-t border-slate-100 pt-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-700">
            {t('AttachmentManager.title')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('AttachmentManager.description')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-all hover:border-[#0d7c66] hover:text-[#0d7c66]"
        >
          <CloudUpload className="h-3.5 w-3.5" />
          {t('AttachmentManager.addFile')}
        </button>
      </div>

      {/* Vùng kéo thả */}
      <div
        className={`rounded-2xl border-2 border-dashed p-5 transition-all text-center ${
          dragActive
            ? 'border-[#0d7c66] bg-[#0d7c66]/5'
            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => {
          if (additionalFiles.length === 0) {
            fileInputRef.current?.click();
          }
        }}
        style={{ cursor: additionalFiles.length === 0 ? 'pointer' : 'default' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md"
          onChange={handleChange}
          onClick={(e) => {
            (e.target as HTMLInputElement).value = '';
          }}
        />

        {additionalFiles.length === 0 ? (
          <div className="flex flex-col items-center py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 mb-2">
              <CloudUpload className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {t('AttachmentManager.emptyTitle')}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {t('AttachmentManager.emptyHint')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto px-1 text-left">
            {additionalFiles.map((file, index) => {
              const { iconColor, borderColor } = getFileStyle(file.name);
              const ext = file.name.split('.').pop()?.toLowerCase();
              const isLegacy = ext === 'doc' || ext === 'ppt';

              return (
                <div
                  key={`${file.name}-${index}`}
                  className={`group flex items-center justify-between gap-3 rounded-xl border bg-white p-2.5 transition-all ${borderColor} ${
                    isLegacy ? 'border-amber-200 bg-amber-50/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 line-clamp-1 flex items-center gap-1.5">
                        {file.name}
                        {isLegacy && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 text-[9px] font-black text-amber-800">
                            {t('AttachmentManager.legacyBadge')}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-semibold">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-100 bg-white text-slate-400 transition-all hover:border-red-200 hover:text-red-500"
                    title={t('AttachmentManager.removeTitle')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cảnh báo định dạng cũ (.doc, .ppt) */}
      {hasLegacyFiles && (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs leading-5 text-amber-900 animate-fade-in">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <strong className="font-extrabold block mb-0.5">{t('AttachmentManager.legacyWarning.title')}</strong>
            {t('AttachmentManager.legacyWarning.body')}
          </div>
        </div>
      )}
    </div>
  );
};
