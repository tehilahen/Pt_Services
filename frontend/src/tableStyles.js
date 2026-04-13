import {
  APP_ACCENT_MAIN,
  APP_ACCENT_SURFACE,
  APP_BORDER_BLUE,
  APP_TEXT_PRIMARY,
} from './themeTokens';

/** מיכל טבלה — SOC / tech */
export const tableContainerPaperSx = {
  background: '#ffffff',
  border: `1px solid ${APP_BORDER_BLUE}`,
  borderRadius: '14px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
  direction: 'rtl',
  overflow: 'hidden',
};

/** גלילה — accent ירקרק */
export const tableScrollbarSx = {
  '&::-webkit-scrollbar': { width: '8px', height: '8px' },
  '&::-webkit-scrollbar-track': {
    backgroundColor: APP_ACCENT_SURFACE,
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(168, 85, 247, 0.35)',
    borderRadius: '4px',
    '&:hover': { backgroundColor: 'rgba(168, 85, 247, 0.55)' },
  },
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(168, 85, 247, 0.35) #FAF5FF',
};

export const tableStickyRtlSx = { direction: 'rtl' };

/** כותרת טבלה — בהירה וחדה עם קו accent */
export const tableHeadCellSx = {
  fontWeight: 700,
  color: APP_TEXT_PRIMARY,
  backgroundColor: '#F8FAFC',
  borderBottom: `2px solid ${APP_ACCENT_MAIN}`,
  fontSize: '0.875rem',
  py: 1.75,
  letterSpacing: '0.02em',
};

/** כותרת עם מיון / קליק */
export const tableHeadCellSortableSx = {
  ...tableHeadCellSx,
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  '&:hover': { backgroundColor: APP_ACCENT_SURFACE },
};

/** שורת גוף */
export const tableBodyRowSx = {
  backgroundColor: '#ffffff',
  '&:hover': { backgroundColor: 'rgba(168, 85, 247, 0.06)' },
  borderBottom: `1px solid ${APP_BORDER_BLUE}`,
  transition: 'background-color 0.2s ease',
};

/** כותרת לטבלה מקוננת (קטנה יותר) */
export const tableNestedHeadCellSx = {
  ...tableHeadCellSx,
  fontSize: '0.78rem',
  py: 1,
};

/** כותרת sticky (כותרת נשארת בגלילה) */
export function tableHeadCellStickySx(overrides = {}) {
  return {
    ...tableHeadCellSx,
    position: 'sticky',
    top: 0,
    zIndex: 10,
    ...overrides,
  };
}
