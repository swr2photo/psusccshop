/**
 * Cookie Management Library
 * ระบบจัดการคุกกี้สำหรับเว็บไซต์
 */

// ============== TYPES ==============

export type CookieCategory = 'essential' | 'functional' | 'analytics' | 'marketing';

export interface CookieConsent {
  essential: boolean;      // คุกกี้ที่จำเป็น (ปิดไม่ได้)
  functional: boolean;     // คุกกี้เพื่อการทำงาน (ตะกร้า, session)
  analytics: boolean;      // คุกกี้วิเคราะห์ข้อมูล
  marketing: boolean;      // คุกกี้โฆษณา
  timestamp: number;
  version: string;
}

export interface CookieOptions {
  expires?: number | Date;   // จำนวนวัน หรือ Date object
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  httpOnly?: boolean;
}

// ============== CONSTANTS ==============

export const COOKIE_CONSENT_KEY = 'cookie_consent';
export const COOKIE_CONSENT_VERSION = '1.0';
export const DEFAULT_COOKIE_EXPIRY_DAYS = 365;

export const COOKIE_CATEGORIES: Record<CookieCategory, { name: string; description: string; required: boolean }> = {
  essential: {
    name: 'คุกกี้ที่จำเป็น',
    description: 'จำเป็นสำหรับการทำงานพื้นฐานของเว็บไซต์ เช่น การเข้าสู่ระบบ',
    required: true,
  },
  functional: {
    name: 'คุกกี้ฟังก์ชัน',
    description: 'ช่วยจดจำตะกร้าสินค้า, ข้อมูลส่วนตัว, และการตั้งค่าต่างๆ',
    required: false,
  },
  analytics: {
    name: 'คุกกี้วิเคราะห์',
    description: 'ช่วยเราเข้าใจการใช้งานเว็บไซต์เพื่อปรับปรุงบริการ',
    required: false,
  },
  marketing: {
    name: 'คุกกี้การตลาด',
    description: 'ใช้แสดงโฆษณาที่ตรงกับความสนใจของคุณ',
    required: false,
  },
};

// ============== COOKIE UTILITIES ==============

/**
 * ตั้งค่าคุกกี้
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === 'undefined') return;

  const {
    expires = DEFAULT_COOKIE_EXPIRY_DAYS,
    path = '/',
    domain,
    secure = process.env.NODE_ENV === 'production',
    sameSite = 'lax',
  } = options;

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (typeof expires === 'number') {
    const date = new Date();
    date.setTime(date.getTime() + expires * 24 * 60 * 60 * 1000);
    cookieString += `; expires=${date.toUTCString()}`;
  } else if (expires instanceof Date) {
    cookieString += `; expires=${expires.toUTCString()}`;
  }

  if (path) cookieString += `; path=${path}`;
  if (domain) cookieString += `; domain=${domain}`;
  if (secure) cookieString += '; secure';
  cookieString += `; samesite=${sameSite}`;

  document.cookie = cookieString;
}

/**
 * อ่านค่าคุกกี้
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';');
  const encodedName = encodeURIComponent(name);

  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    if (cookieName === encodedName) {
      return decodeURIComponent(cookieValue || '');
    }
  }

  return null;
}

/**
 * ลบคุกกี้
 */
export function deleteCookie(name: string, path = '/'): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
}

/**
 * ตรวจสอบว่ามีคุกกี้หรือไม่
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null;
}

// ============== CONSENT MANAGEMENT ==============

/**
 * ดึงค่าความยินยอมคุกกี้
 */
export function getConsentState(): CookieConsent | null {
  try {
    const raw = getCookie(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    
    const consent = JSON.parse(raw) as CookieConsent;
    
    // ตรวจสอบ version
    if (consent.version !== COOKIE_CONSENT_VERSION) {
      return null;
    }
    
    return consent;
  } catch {
    return null;
  }
}

/**
 * บันทึกความยินยอมคุกกี้
 */
export function saveConsentState(consent: Partial<Omit<CookieConsent, 'timestamp' | 'version'>>): CookieConsent {
  const fullConsent: CookieConsent = {
    essential: true, // ต้องเป็น true เสมอ
    functional: consent.functional ?? true,
    analytics: consent.analytics ?? false,
    marketing: consent.marketing ?? false,
    timestamp: Date.now(),
    version: COOKIE_CONSENT_VERSION,
  };

  setCookie(COOKIE_CONSENT_KEY, JSON.stringify(fullConsent), {
    expires: DEFAULT_COOKIE_EXPIRY_DAYS,
    sameSite: 'lax',
  });

  return fullConsent;
}

/**
 * ยอมรับคุกกี้ทั้งหมด
 */
export function acceptAllCookies(): CookieConsent {
  return saveConsentState({
    essential: true,
    functional: true,
    analytics: true,
    marketing: true,
  });
}

/**
 * ยอมรับเฉพาะคุกกี้ที่จำเป็น
 */
export function acceptEssentialOnly(): CookieConsent {
  return saveConsentState({
    essential: true,
    functional: false,
    analytics: false,
    marketing: false,
  });
}

/**
 * ตรวจสอบว่ายินยอมหมวดหมู่นี้หรือไม่
 */
export function hasConsent(category: CookieCategory): boolean {
  if (category === 'essential') return true;
  const consent = getConsentState();
  return consent?.[category] ?? false;
}

/**
 * ตรวจสอบว่าผู้ใช้ได้ตั้งค่าคุกกี้แล้วหรือยัง
 */
export function hasConsentBeenSet(): boolean {
  return getConsentState() !== null;
}

// ============== FUNCTIONAL COOKIES ==============

/**
 * บันทึกข้อมูลลง localStorage พร้อมตรวจสอบ consent
 */
export function setLocalStorage(key: string, value: any, category: CookieCategory = 'functional'): boolean {
  if (typeof localStorage === 'undefined') return false;
  if (!hasConsent(category)) return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * อ่านข้อมูลจาก localStorage
 */
export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') return defaultValue;

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * ลบข้อมูลจาก localStorage
 */
export function removeLocalStorage(key: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
}

/**
 * บันทึกข้อมูลลง sessionStorage พร้อมตรวจสอบ consent
 */
export function setSessionStorage(key: string, value: any, category: CookieCategory = 'functional'): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  if (!hasConsent(category)) return false;

  try {
    sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * อ่านข้อมูลจาก sessionStorage
 */
export function getSessionStorage<T>(key: string, defaultValue: T): T {
  if (typeof sessionStorage === 'undefined') return defaultValue;

  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

// ============== THEME & PREFERENCES ==============

const THEME_KEY = 'user_theme';
const PREFERENCES_KEY = 'user_preferences';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface UserPreferences {
  theme: ThemeMode;
  reducedMotion: boolean;
  compactView: boolean;
  language: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  reducedMotion: false,
  compactView: false,
  language: 'th',
};

export function getTheme(): ThemeMode {
  return getLocalStorage<ThemeMode>(THEME_KEY, 'dark');
}

export function setTheme(theme: ThemeMode): void {
  setLocalStorage(THEME_KEY, theme, 'functional');
}

export function getUserPreferences(): UserPreferences {
  return getLocalStorage<UserPreferences>(PREFERENCES_KEY, DEFAULT_PREFERENCES);
}

export function setUserPreferences(preferences: Partial<UserPreferences>): void {
  const current = getUserPreferences();
  setLocalStorage(PREFERENCES_KEY, { ...current, ...preferences }, 'functional');
}

// ============== CART & SESSION ==============

const CART_TEMP_KEY = 'cart_temp';
const LAST_VISIT_KEY = 'last_visit';
const VIEW_HISTORY_KEY = 'view_history';

export function saveCartTemp(cart: any[]): void {
  setLocalStorage(CART_TEMP_KEY, cart, 'functional');
}

export function getCartTemp(): any[] {
  return getLocalStorage<any[]>(CART_TEMP_KEY, []);
}

export function clearCartTemp(): void {
  removeLocalStorage(CART_TEMP_KEY);
}

export function recordLastVisit(): void {
  setCookie(LAST_VISIT_KEY, new Date().toISOString(), { expires: 30 });
}

export function getLastVisit(): Date | null {
  const raw = getCookie(LAST_VISIT_KEY);
  return raw ? new Date(raw) : null;
}

export function addToViewHistory(productId: string): void {
  if (!hasConsent('functional')) return;
  
  const history = getLocalStorage<string[]>(VIEW_HISTORY_KEY, []);
  const filtered = history.filter((id) => id !== productId);
  filtered.unshift(productId);
  
  // เก็บแค่ 20 รายการล่าสุด
  setLocalStorage(VIEW_HISTORY_KEY, filtered.slice(0, 20), 'functional');
}

export function getViewHistory(): string[] {
  return getLocalStorage<string[]>(VIEW_HISTORY_KEY, []);
}

export function clearViewHistory(): void {
  removeLocalStorage(VIEW_HISTORY_KEY);
}
