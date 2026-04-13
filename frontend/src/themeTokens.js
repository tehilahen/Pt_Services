/**
 * Design tokens — מראה tech נקי עם accent סגול–מגנטה.
 * שמות APP_PRIMARY_BLUE* נשמרים כ-alias לתאימות לאחור עם הקוד הקיים.
 */
/** פונט מערכת: עברית (IBM Plex Sans Hebrew) + לטיני (IBM Plex Sans) */
export const APP_FONT_FAMILY =
  '"IBM Plex Sans Hebrew", "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Accent (פעולות, ניווט פעיל, הדגשות) — violet / magenta */
export const APP_ACCENT_MAIN = '#A855F7';
export const APP_ACCENT_LIGHT = '#F3E8FF';
export const APP_ACCENT_SURFACE = '#FAF5FF';
export const APP_ACCENT_DARK = '#7C3AED';
/** זוהר עדין ל-hover / focus */
export const APP_ACCENT_GLOW = 'rgba(168, 85, 247, 0.12)';
export const APP_ACCENT_GLOW_STRONG = 'rgba(168, 85, 247, 0.22)';

/** תאימות לאחור — ממופה לאקסנט */
export const APP_PRIMARY_BLUE = APP_ACCENT_MAIN;
export const APP_PRIMARY_BLUE_LIGHT = APP_ACCENT_LIGHT;
export const APP_PRIMARY_BLUE_DARK = APP_ACCENT_DARK;

/** משטחים */
export const APP_BACKGROUND_DEFAULT = '#F1F5F9';
export const APP_BACKGROUND_ELEVATED = '#F8FAFC';
export const APP_BACKGROUND_PAPER = '#FFFFFF';

/** טקסט */
export const APP_TEXT_PRIMARY = '#0F172A';
export const APP_TEXT_SECONDARY = '#334155';
export const APP_TEXT_MUTED = '#94A3B8';

/** גבולות ניטרליים */
export const APP_BORDER_DEFAULT = '#E2E8F0';
export const APP_BORDER_SOFT = '#CBD5E1';

/** Legacy — אותו ערך כמו APP_BORDER_* */
export const APP_BORDER_BLUE = APP_BORDER_DEFAULT;
export const APP_BORDER_BLUE_SOFT = APP_BORDER_SOFT;

/** חומרה */
export const APP_SEVERITY_CRITICAL = '#DC2626';
export const APP_SEVERITY_HIGH = '#EA580C';
export const APP_SEVERITY_MEDIUM = '#D97706';
export const APP_SEVERITY_LOW = '#16A34A';

/** סטטוס תפעולי — "פתוח" מיושר לאקסנט; resolved נשאר ירוק סמנטי */
export const APP_STATUS_OPEN = '#7C3AED';
export const APP_STATUS_RESOLVED = '#16A34A';
export const APP_STATUS_IGNORED = '#64748B';
export const APP_STATUS_FAILED = '#B91C1C';
