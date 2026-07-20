export const DATER_SCREEN_BG = '#fff5f7';
export const DATER_SURFACE_BORDER = '#fadce6';

export const getRoleAccentColor = (role) =>
  role === 'user' ? '#ef4d73' : '#6c5ce7';

export const getRoleBackgroundTint = (role) =>
  role === 'user' ? DATER_SCREEN_BG : 'rgba(108, 92, 231, 0.08)';

export const getRoleContainerColor = (role) =>
  role === 'user' ? '#ffe6ee' : '#efe7ff';

export const getRoleLabel = (role) =>
  role === 'user' ? 'DATER' : 'MATCHMAKER';
