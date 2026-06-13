import { Capacitor } from '@capacitor/core';

/**
 * "Web demo mode": ban web la phien ban dung thu / tra phi-hoac-ads.
 * Tren web, nguoi dung KHONG cau hinh provider/API key/model... ma luon chay
 * qua backend proxy bang key cua admin. Cac thiet lap ky thuat bi an di.
 *
 * Ban native (Android/iOS) giu nguyen toan bo cau hinh nhu cu.
 */
export const isWebDemo = (): boolean => Capacitor.getPlatform() === 'web';

/** Tien ich nguoc lai cho de doc tai cac diem goi. */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();
