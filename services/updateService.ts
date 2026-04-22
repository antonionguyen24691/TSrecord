/**
 * updateService.ts
 * Kiểm tra phiên bản mới qua GitHub Releases API và dùng native updater trên Android.
 */

import { Capacitor } from '@capacitor/core';
import { AppUpdate } from '../plugins/appUpdate';

const GITHUB_OWNER: string = 'antonionguyen24691';
const GITHUB_REPO: string = 'TSrecord';

export interface ReleaseInfo {
  version: string;
  tagName: string;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
  isAndroid: boolean;
  currentVersion: string;
  currentVersionCode: number;
  apkFileName: string;
}

export interface UpdateProgressState {
  downloadId: number;
  status: 'pending' | 'running' | 'paused' | 'successful' | 'failed' | 'missing';
  downloadedBytes: number;
  totalBytes: number;
  localUri: string;
  reason: string;
  canInstall: boolean;
  canRequestPackageInstalls: boolean;
}

const parseVersion = (value: string) =>
  value
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number(part) || 0);

const isNewerVersion = (candidate: string, current: string): boolean => {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  const maxLength = Math.max(candidateParts.length, currentParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const candidateValue = candidateParts[index] || 0;
    const currentValue = currentParts[index] || 0;
    if (candidateValue !== currentValue) return candidateValue > currentValue;
  }

  return false;
};

const buildApkFileName = (version: string) => `TSrecord-v${version}.apk`;

export const getInstalledVersion = async () => {
  if (Capacitor.getPlatform() !== 'android') {
    return {
      versionName: 'dev',
      versionCode: 0,
      canRequestPackageInstalls: false,
    };
  }

  return AppUpdate.getCurrentVersion();
};

export const checkForUpdate = async (): Promise<ReleaseInfo | null> => {
  if (Capacitor.getPlatform() !== 'android') return null;
  if (GITHUB_OWNER === 'YOUR_GITHUB_USERNAME') return null;

  try {
    const installed = await getInstalledVersion();
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'TSrecord-Android-App',
        },
      }
    );

    if (!response.ok) return null;

    const release = await response.json();
    const latestVersion = String(release.tag_name || '').replace(/^v/, '');

    if (!latestVersion || !isNewerVersion(latestVersion, installed.versionName)) {
      return null;
    }

    const assets: Array<{ name: string; browser_download_url: string }> = release.assets || [];
    const apkAsset = assets.find((asset) => asset.name.toLowerCase().endsWith('.apk'));

    return {
      version: latestVersion,
      tagName: release.tag_name,
      releaseNotes: (release.body as string) || 'Không có ghi chú phiên bản.',
      downloadUrl: apkAsset?.browser_download_url || release.html_url,
      publishedAt: release.published_at,
      isAndroid: !!apkAsset,
      currentVersion: installed.versionName,
      currentVersionCode: Number(installed.versionCode || 0),
      apkFileName: apkAsset?.name || buildApkFileName(latestVersion),
    };
  } catch {
    return null;
  }
};

export const startUpdateDownload = async (release: ReleaseInfo) => {
  return AppUpdate.startUpdate({
    downloadUrl: release.downloadUrl,
    fileName: release.apkFileName,
    title: `TSrecord ${release.version}`,
  });
};

export const getUpdateDownloadStatus = async (downloadId: number): Promise<UpdateProgressState> => {
  const status = await AppUpdate.getDownloadStatus({ downloadId });
  return {
    downloadId,
    ...status,
  };
};

export const openInstaller = async () => {
  await AppUpdate.openInstaller();
};
