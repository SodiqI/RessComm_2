// Brand logo helpers for PDF embedding.
// Loads the RessComm logo as a base64 PNG data URL (cached).
import logoUrl from '@/assets/resscomm-logo.png';

let cached: string | null = null;
let pending: Promise<string | null> | null = null;

export const BRAND_LOGO_URL = logoUrl;

export async function getBrandLogoDataUrl(): Promise<string | null> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    try {
      const res = await fetch(logoUrl);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      cached = dataUrl;
      return dataUrl;
    } catch (e) {
      console.warn('Brand logo could not be loaded for PDF:', e);
      return null;
    }
  })();

  return pending;
}
