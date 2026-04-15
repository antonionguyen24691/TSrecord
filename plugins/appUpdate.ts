import { registerPlugin } from '@capacitor/core';

export interface AppVersionInfo {
  packageName: string;
  versionName: string;
  versionCode: number;
  canRequestPackageInstalls: boolean;
}

export interface AppUpdateStartResult {
  downloadId: number;
  fileName: string;
  started: boolean;
  canRequestPackageInstalls: boolean;
}

export interface AppUpdateDownloadStatus {
  status: 'pending' | 'running' | 'paused' | 'successful' | 'failed' | 'missing';
  downloadedBytes: number;
  totalBytes: number;
  localUri: string;
  reason: string;
  canInstall: boolean;
  canRequestPackageInstalls: boolean;
}

interface AppUpdatePlugin {
  getCurrentVersion(): Promise<AppVersionInfo>;
  startUpdate(options: {
    downloadUrl: string;
    fileName?: string;
    title?: string;
  }): Promise<AppUpdateStartResult>;
  getDownloadStatus(options: { downloadId: number }): Promise<AppUpdateDownloadStatus>;
  openInstaller(): Promise<void>;
}

export const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate');
