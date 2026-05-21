import { Capacitor } from '@capacitor/core';
import { Directory } from '@capacitor/filesystem';

export const STORAGE_ROOT = 'TSrecord';
export const LEGACY_PUBLIC_STORAGE_ROOT = 'TSrecord';

export const getAppStorageDirectory = () =>
  Capacitor.isNativePlatform() ? Directory.Data : Directory.Documents;

export const getExportDirectory = () => Directory.Documents;

export const getAppStorageLabel = () =>
  Capacitor.isNativePlatform() ? 'Bộ nhớ nội bộ ứng dụng/TSrecord' : 'Documents/TSrecord';

export const getLegacyStorageLabel = () => 'Documents/TSrecord';
