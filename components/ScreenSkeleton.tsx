import React from 'react';
import { useTranslation } from 'react-i18next';

type ScreenSkeletonVariant =
  | 'workspace'
  | 'upload'
  | 'record'
  | 'audioEditor'
  | 'mode'
  | 'result'
  | 'export';

interface ScreenSkeletonProps {
  variant: ScreenSkeletonVariant;
  label?: string;
}

const SkeletonBar: React.FC<{
  width?: string;
  height?: string;
  rounded?: string;
  className?: string;
}> = ({ width = '100%', height = '16px', rounded = '999px', className = '' }) => (
  <div
    className={`app-skeleton ${className}`}
    style={{
      width,
      height,
      borderRadius: rounded,
    }}
  />
);

const ScreenShell: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="rounded-[28px] border border-white/60 bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] md:p-6">
    <div className="mb-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0d7c66]">
        {label}
      </div>
    </div>
    {children}
  </div>
);

export const ScreenSkeleton: React.FC<ScreenSkeletonProps> = ({ variant, label }) => {
  const { t } = useTranslation();
  if (variant === 'workspace') {
    return (
      <ScreenShell label={label || t('ScreenSkeleton.workspace')}>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <SkeletonBar width="140px" height="32px" rounded="999px" />
            <SkeletonBar width="72%" height="44px" rounded="20px" />
            <SkeletonBar width="92%" />
            <SkeletonBar width="86%" />
            <div className="flex flex-wrap gap-3 pt-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <SkeletonBar width="84px" height="12px" className="mb-3" />
                  <SkeletonBar width="48px" height="28px" rounded="14px" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <SkeletonBar width="220px" height="12px" className="mb-4" />
            <SkeletonBar width="100%" height="54px" rounded="18px" />
            <SkeletonBar width="170px" height="46px" rounded="18px" className="mt-4" />
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {[1, 2].map((item) => (
            <div key={item} className="rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap gap-2">
                <SkeletonBar width="110px" height="30px" rounded="999px" />
                <SkeletonBar width="130px" height="30px" rounded="999px" />
                <SkeletonBar width="120px" height="30px" rounded="999px" />
              </div>
              <SkeletonBar width="45%" height="28px" rounded="16px" className="mt-4" />
              <SkeletonBar width="62%" className="mt-3" />
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[1, 2, 3].map((cell) => (
                  <div key={cell} className="rounded-2xl bg-slate-50 p-4">
                    <SkeletonBar width="90px" height="12px" className="mb-3" />
                    <SkeletonBar width="100%" />
                    <SkeletonBar width="84%" className="mt-2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScreenShell>
    );
  }

  if (variant === 'record') {
    return (
      <ScreenShell label={label || t('ScreenSkeleton.record')}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[32px] bg-slate-950 p-6">
            <SkeletonBar width="110px" height="12px" className="mb-4 app-skeleton--dark" />
            <SkeletonBar width="70%" height="34px" rounded="18px" className="app-skeleton--dark" />
            <div className="mt-8 space-y-4">
              {[1, 2].map((item) => (
                <div key={item} className="rounded-[20px] border border-white/10 p-4">
                  <div className="flex items-start gap-4">
                    <SkeletonBar
                      width="48px"
                      height="48px"
                      rounded="18px"
                      className="app-skeleton--dark"
                    />
                    <div className="flex-1">
                      <SkeletonBar width="120px" height="18px" className="app-skeleton--dark" />
                      <SkeletonBar width="90%" className="mt-3 app-skeleton--dark" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SkeletonBar width="130px" height="12px" className="mb-4" />
                <SkeletonBar width="58%" height="34px" rounded="18px" />
              </div>
              <div className="rounded-[24px] bg-slate-100 p-4">
                <SkeletonBar width="72px" height="34px" rounded="16px" />
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              {[180, 150, 140].map((width, index) => (
                <SkeletonBar
                  key={index}
                  width={`${width}px`}
                  height="56px"
                  rounded="18px"
                />
              ))}
            </div>
            <SkeletonBar width="100%" height="92px" rounded="24px" className="mt-6" />
          </div>
        </div>
      </ScreenShell>
    );
  }

  if (variant === 'audioEditor') {
    return (
      <ScreenShell label={label || t('ScreenSkeleton.audioEditor')}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] bg-slate-950 p-5">
            <SkeletonBar width="120px" height="12px" className="mb-4 app-skeleton--dark" />
            <SkeletonBar width="68%" height="36px" rounded="18px" className="app-skeleton--dark" />
            <SkeletonBar width="92%" className="mt-4 app-skeleton--dark" />
            <SkeletonBar width="100%" height="180px" rounded="24px" className="mt-6 app-skeleton--dark" />
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex justify-between gap-3">
              <div className="flex-1">
                <SkeletonBar width="110px" height="12px" className="mb-4" />
                <SkeletonBar width="58%" height="34px" rounded="18px" />
              </div>
              <SkeletonBar width="120px" height="44px" rounded="14px" />
            </div>
            <SkeletonBar width="100%" height="120px" rounded="24px" className="mt-5" />
            <SkeletonBar width="100%" height="52px" rounded="16px" className="mt-5" />
            <SkeletonBar width="100%" height="52px" rounded="16px" className="mt-4" />
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <SkeletonBar width="100%" height="56px" rounded="18px" />
              <SkeletonBar width="100%" height="56px" rounded="18px" />
            </div>
          </div>
        </div>
      </ScreenShell>
    );
  }

  if (variant === 'mode') {
    return (
      <ScreenShell label={label || t('ScreenSkeleton.mode')}>
        <SkeletonBar width="160px" height="12px" className="mb-4" />
        <SkeletonBar width="50%" height="36px" rounded="18px" />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <SkeletonBar width="46px" height="46px" rounded="16px" />
              <SkeletonBar width="44%" height="22px" rounded="12px" className="mt-4" />
              <SkeletonBar width="92%" className="mt-3" />
              <SkeletonBar width="76%" className="mt-2" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <SkeletonBar width="130px" height="54px" rounded="18px" />
          <SkeletonBar width="220px" height="54px" rounded="18px" />
        </div>
      </ScreenShell>
    );
  }

  if (variant === 'result') {
    return (
      <ScreenShell label={label || t('ScreenSkeleton.result')}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[248px_1fr]">
          <div className="rounded-[24px] bg-slate-950 p-5">
            <SkeletonBar width="120px" height="12px" className="mb-5 app-skeleton--dark" />
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="mb-3 rounded-[18px] border border-white/10 p-4">
                <div className="flex items-center gap-3">
                  <SkeletonBar
                    width="40px"
                    height="40px"
                    rounded="14px"
                    className="app-skeleton--dark"
                  />
                  <div className="flex-1">
                    <SkeletonBar width="74%" height="16px" className="app-skeleton--dark" />
                    <SkeletonBar width="88%" height="12px" className="mt-2 app-skeleton--dark" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <SkeletonBar width="160px" height="16px" className="mb-3" />
                <SkeletonBar width="34%" height="26px" rounded="14px" />
              </div>
              <div className="flex gap-2">
                <SkeletonBar width="96px" height="38px" rounded="14px" />
                <SkeletonBar width="120px" height="38px" rounded="14px" />
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <SkeletonBar width="120px" height="14px" className="mb-3" />
                  <SkeletonBar width="100%" />
                  <SkeletonBar width="94%" className="mt-2" />
                  <SkeletonBar width="88%" className="mt-2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScreenShell>
    );
  }

  if (variant === 'export') {
    return (
      <ScreenShell label={label || t('ScreenSkeleton.export')}>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <SkeletonBar width="120px" height="12px" className="mb-4" />
            <SkeletonBar width="58%" height="36px" rounded="18px" />
            <SkeletonBar width="90%" className="mt-4" />
            <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <SkeletonBar width="130px" height="12px" className="mb-4" />
              <SkeletonBar width="100%" height="58px" rounded="18px" />
              <div className="mt-4 flex flex-wrap gap-2">
                {['90px', '90px', '90px', '90px'].map((width, index) => (
                  <SkeletonBar key={index} width={width} height="32px" rounded="999px" />
                ))}
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <SkeletonBar width="100%" height="104px" rounded="26px" />
              <SkeletonBar width="100%" height="104px" rounded="26px" />
            </div>
          </div>
          <div className="rounded-[28px] bg-slate-950 p-5">
            <SkeletonBar width="140px" height="12px" className="mb-4 app-skeleton--dark" />
            <SkeletonBar width="68%" height="34px" rounded="18px" className="app-skeleton--dark" />
            <SkeletonBar width="92%" className="mt-4 app-skeleton--dark" />
            <SkeletonBar width="100%" height="54px" rounded="18px" className="mt-6 app-skeleton--dark" />
            <SkeletonBar width="100%" height="76px" rounded="18px" className="mt-4 app-skeleton--dark" />
          </div>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell label={label || t('ScreenSkeleton.default')}>
      <SkeletonBar width="140px" height="12px" className="mb-4" />
      <SkeletonBar width="54%" height="36px" rounded="18px" />
      <SkeletonBar width="90%" className="mt-4" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[1, 2].map((item) => (
          <SkeletonBar key={item} width="100%" height="140px" rounded="26px" />
        ))}
      </div>
    </ScreenShell>
  );
};
