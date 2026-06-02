/** Shared post-login / post-signup routing when profile setup is incomplete. */

export function needsProfileCompletion(user) {
  return user?.profile_completion_step != null;
}

export function getPostAuthNavigationReset(user, { shouldPromptLinkedDater = false } = {}) {
  if (needsProfileCompletion(user)) {
    if (user?.role === 'matchmaker' || user?.role === 'user') {
      return {
        index: 0,
        routes: [{ name: 'CompleteProfile' }],
      };
    }
  }

  if (shouldPromptLinkedDater) {
    return {
      index: 0,
      routes: [
        {
          name: 'Main',
          params: {
            screen: 'Settings',
            params: { showLinkedDatersOnboarding: true },
          },
        },
      ],
    };
  }

  return {
    index: 0,
    routes: [{ name: 'Main', params: { screen: 'Matches' } }],
  };
}
