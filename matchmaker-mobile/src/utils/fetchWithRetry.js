const isTransientFetchError = (err) =>
  err instanceof TypeError &&
  /network request failed/i.test(String(err?.message ?? err));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry fetch on transient network failures (Railway cold start, mobile radio hiccups).
 * @param {string} url
 * @param {RequestInit} fetchOptions
 * @param {{ retries?: number, baseDelayMs?: number }} retryOptions
 */
export async function fetchWithRetry(url, fetchOptions = {}, retryOptions = {}) {
  const { retries = 3, baseDelayMs = 400 } = retryOptions;
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetch(url, fetchOptions);
    } catch (err) {
      lastErr = err;
      if (!isTransientFetchError(err) || attempt === retries - 1) {
        throw err;
      }
      await sleep(baseDelayMs * (attempt + 1));
    }
  }
  throw lastErr;
}

export { isTransientFetchError };
