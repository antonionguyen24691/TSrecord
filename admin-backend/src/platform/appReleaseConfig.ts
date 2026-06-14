import { one } from './database.js';

export interface AppReleaseConfig {
  minVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  androidUrl: string;
  iosUrl: string;
  notes: string;
  updatedAt: string | null;
}

interface AppReleaseRow {
  min_version: string;
  latest_version: string;
  force_update: boolean;
  android_url: string;
  ios_url: string;
  notes: string;
  updated_at: string;
}

const DEFAULTS: AppReleaseConfig = {
  minVersion: '0.0.0',
  latestVersion: '1.4.6',
  forceUpdate: false,
  androidUrl: '',
  iosUrl: '',
  notes: '',
  updatedAt: null,
};

const toPublic = (row: AppReleaseRow): AppReleaseConfig => ({
  minVersion: row.min_version,
  latestVersion: row.latest_version,
  forceUpdate: row.force_update,
  androidUrl: row.android_url,
  iosUrl: row.ios_url,
  notes: row.notes,
  updatedAt: row.updated_at,
});

export const getAppReleaseConfig = async (): Promise<AppReleaseConfig> => {
  const row = await one<AppReleaseRow>('SELECT * FROM app_release_config_v2 WHERE id = 1');
  return row ? toPublic(row) : { ...DEFAULTS };
};

export const updateAppReleaseConfig = async (
  patch: Partial<Omit<AppReleaseConfig, 'updatedAt'>>
): Promise<AppReleaseConfig> => {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  const push = (col: string, value: unknown) => {
    sets.push(`${col} = $${idx++}`);
    values.push(value);
  };
  if (typeof patch.minVersion === 'string') push('min_version', patch.minVersion.trim() || '0.0.0');
  if (typeof patch.latestVersion === 'string') push('latest_version', patch.latestVersion.trim() || '0.0.0');
  if (typeof patch.forceUpdate === 'boolean') push('force_update', patch.forceUpdate);
  if (typeof patch.androidUrl === 'string') push('android_url', patch.androidUrl.trim());
  if (typeof patch.iosUrl === 'string') push('ios_url', patch.iosUrl.trim());
  if (typeof patch.notes === 'string') push('notes', patch.notes.slice(0, 4000));

  if (sets.length === 0) return getAppReleaseConfig();
  sets.push('updated_at = now()');
  const row = await one<AppReleaseRow>(
    `UPDATE app_release_config_v2 SET ${sets.join(', ')} WHERE id = 1 RETURNING *`,
    values
  );
  return row ? toPublic(row) : getAppReleaseConfig();
};

/** So sánh phiên bản dạng "1.4.6". Trả về <0, 0, >0 như a-b. */
export const compareVersions = (a: string, b: string): number => {
  const pa = String(a || '').replace(/^v/i, '').split('.').map((x) => Number(x) || 0);
  const pb = String(b || '').replace(/^v/i, '').split('.').map((x) => Number(x) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
};

/** Đánh giá trạng thái cập nhật cho một phiên bản client cụ thể. */
export const evaluateVersionGate = (
  config: AppReleaseConfig,
  platform: string,
  currentVersion: string
) => {
  const url = platform === 'ios' ? config.iosUrl : config.androidUrl;
  const hasVersion = Boolean(currentVersion && currentVersion !== 'web' && currentVersion !== 'dev');
  const updateRequired = hasVersion && config.forceUpdate && compareVersions(currentVersion, config.minVersion) < 0;
  const updateAvailable = hasVersion && compareVersions(currentVersion, config.latestVersion) < 0;
  return {
    minVersion: config.minVersion,
    latestVersion: config.latestVersion,
    forceUpdate: config.forceUpdate,
    notes: config.notes,
    updateUrl: url,
    updateRequired,
    updateAvailable,
  };
};

// Fallback SQLite (legacy): doc tu system_config neu khong dung Postgres.
export const sqliteKeys = {
  min: 'app_min_version',
  latest: 'app_latest_version',
  force: 'app_force_update',
  android: 'app_android_url',
  ios: 'app_ios_url',
  notes: 'app_update_notes',
};

export const buildConfigFromValues = (read: (key: string) => string): AppReleaseConfig => ({
  minVersion: read(sqliteKeys.min) || DEFAULTS.minVersion,
  latestVersion: read(sqliteKeys.latest) || DEFAULTS.latestVersion,
  forceUpdate: read(sqliteKeys.force) === 'true',
  androidUrl: read(sqliteKeys.android) || '',
  iosUrl: read(sqliteKeys.ios) || '',
  notes: read(sqliteKeys.notes) || '',
  updatedAt: null,
});
