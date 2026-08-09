export const DATER_SCREEN_BG = '#fff5f7';
export const DATER_SURFACE_BORDER = '#fadce6';

export const getRoleAccentColor = (role) =>
  role === 'user' ? '#ef4d73' : '#6c5ce7';

/** Matchmaker screen BG matches native `#f3f4f6` (not a translucent violet wash). */
export const MATCHMAKER_SCREEN_BG = '#f3f4f6';

export const getRoleBackgroundTint = (role) =>
  role === 'user' ? DATER_SCREEN_BG : MATCHMAKER_SCREEN_BG;

export const getRoleContainerColor = (role) =>
  role === 'user' ? '#ffe6ee' : '#efe7ff';

export const getRoleLabel = (role) =>
  role === 'user' ? 'DATER' : 'MATCHMAKER';
