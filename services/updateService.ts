/**
 * updateService.ts
 * Kiểm tra phiên bản mới qua GitHub Releases API.
 * Luồng: Check API → So sánh version → Trả về thông tin release nếu có bản mới.
 *
 * Cách dùng:
 * 1. Tạo GitHub repo public
 * 2. Tạo Release với tag "v1.0.0", đính kèm file APK
 * 3. Cập nhật GITHUB_OWNER + GITHUB_REPO bên dưới
 * 4. Mỗi khi release mới, app sẽ tự phát hiện khi khởi động
 */

import { Capacitor } from '@capacitor/core';

// ─── CẤU HÌNH — chỉnh theo GitHub repo của bạn ─────────────────────────────
const GITHUB_OWNER = 'antonionguyen24691'; // Username GitHub của bạn
const GITHUB_REPO = 'TSrecord';           // Tên repo GitHub của bạn
// ─────────────────────────────────────────────────────────────────────────────

export const CURRENT_VERSION = '1.1.0';

export interface ReleaseInfo {
  version: string;          // e.g. "1.1.0"
  tagName: string;          // e.g. "v1.1.0"
  releaseNotes: string;     // Mô tả bản cập nhật
  downloadUrl: string;      // Link tải APK trực tiếp
  publishedAt: string;      // ISO date string
  isAndroid: boolean;       // APK asset có tồn tại không
}

/** So sánh version semantic (major.minor.patch). Trả true nếu a > b */
const isNewerVersion = (a: string, b: string): boolean => {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const [aM, am, ap] = parse(a);
  const [bM, bm, bp] = parse(b);
  if (aM !== bM) return aM > bM;
  if (am !== bm) return am > bm;
  return ap > bp;
};

/**
 * Lấy thông tin release mới nhất từ GitHub.
 * Trả về null nếu không có bản mới hoặc lỗi mạng (fail-safe).
 */
export const checkForUpdate = async (): Promise<ReleaseInfo | null> => {
  // Chỉ check update trên Android (không check trên web browser dev)
  if (Capacitor.getPlatform() !== 'android') return null;

  // Nếu chưa cấu hình repo thì skip
  if (GITHUB_OWNER === 'YOUR_GITHUB_USERNAME') return null;

  try {
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
    const latestVersion = (release.tag_name as string).replace(/^v/, '');

    // Không có bản mới
    if (!isNewerVersion(latestVersion, CURRENT_VERSION)) return null;

    // Tìm APK asset trong release
    const assets: Array<{ name: string; browser_download_url: string }> =
      release.assets || [];
    const apkAsset = assets.find((a) => a.name.endsWith('.apk'));

    return {
      version: latestVersion,
      tagName: release.tag_name,
      releaseNotes: (release.body as string) || 'Không có ghi chú phiên bản.',
      downloadUrl: apkAsset?.browser_download_url || release.html_url,
      publishedAt: release.published_at,
      isAndroid: !!apkAsset,
    };
  } catch {
    // Lỗi mạng hoặc API — không làm ảnh hưởng app
    return null;
  }
};

/** Mở link tải APK hoặc trang release trên trình duyệt */
export const openDownloadLink = (url: string): void => {
  window.open(url, '_system');
};
