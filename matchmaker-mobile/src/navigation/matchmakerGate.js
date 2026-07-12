/** True when a dater finished profile setup but still needs an external matchmaker link. */
export function daterNeedsMatchmakerLink(user) {
  if (!user || user.role !== 'user') return false;
  if (user.profile_completion_step != null) return false;
  if (user.linked_account?.role === 'matchmaker') return false;
  return user.has_linked_matchmaker !== true;
}

export function getMatchmakerGateNavigationReset() {
  return {
    index: 0,
    routes: [
      {
        name: 'Main',
        params: {
          screen: 'Settings',
          params: { requireMatchmaker: true, openReferral: true },
        },
      },
    ],
  };
}
