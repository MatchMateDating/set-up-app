/**
 * Optional hook for main-tab back (Android hardware back + iOS left-edge swipe).
 * Return true if the gesture was handled and tab navigation should not run.
 */
export const mainTabBackDelegateRef = {
  current: null,
};
