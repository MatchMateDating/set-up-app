import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_STORAGE_KEYS = ['token', 'user', 'staySignedIn'];

let suppressAuthErrors = false;

export function beginAuthSessionClear() {
  suppressAuthErrors = true;
}

export function resumeAuthSession() {
  suppressAuthErrors = false;
}

export async function clearAuthSession() {
  beginAuthSessionClear();
  await AsyncStorage.multiRemove(AUTH_STORAGE_KEYS);
}

export async function hasAuthToken() {
  const token = await AsyncStorage.getItem('token');
  return !!token;
}

/** True when auth was cleared or is being cleared (sign-out / account deletion). */
export async function shouldSuppressAuthErrors() {
  if (suppressAuthErrors) return true;
  return !(await hasAuthToken());
}
