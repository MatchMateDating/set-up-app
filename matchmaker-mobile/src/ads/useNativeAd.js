import { useCallback, useEffect, useRef, useState } from 'react';
import { getNativeAdUnitId } from './adConfig';
import { getAdMobModule, initializeAdMob, isAdMobAvailable } from './admobModule';

export const useNativeAd = ({ enabled = true } = {}) => {
  const [nativeAd, setNativeAd] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const nativeAdRef = useRef(null);
  const requestIdRef = useRef(0);
  const adsSupported = isAdMobAvailable();

  const destroyCurrentAd = useCallback(() => {
    if (nativeAdRef.current) {
      nativeAdRef.current.destroy();
      nativeAdRef.current = null;
    }
    setNativeAd(null);
  }, []);

  const reload = useCallback(() => {
    if (!enabled || !adsSupported) {
      destroyCurrentAd();
      setLoading(false);
      setError(null);
      return;
    }

    let admob;
    try {
      admob = getAdMobModule();
    } catch (err) {
      console.warn('AdMob unavailable:', err);
      setLoading(false);
      setError(err);
      return;
    }

    if (!admob?.NativeAd) {
      setLoading(false);
      setError(new Error('AdMob native module unavailable'));
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    destroyCurrentAd();
    setLoading(true);
    setError(null);

    initializeAdMob();

    admob.NativeAd.createForAdRequest(getNativeAdUnitId(), {
      aspectRatio: admob.NativeMediaAspectRatio?.PORTRAIT ?? 3,
    })
      .then((ad) => {
        if (requestIdRef.current !== requestId) {
          ad.destroy();
          return;
        }
        nativeAdRef.current = ad;
        setNativeAd(ad);
        setLoading(false);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) {
          return;
        }
        console.error('Native ad load failed:', err);
        setError(err);
        setLoading(false);
      });
  }, [adsSupported, destroyCurrentAd, enabled]);

  useEffect(() => {
    if (enabled && adsSupported) {
      reload();
    } else {
      destroyCurrentAd();
      setLoading(false);
      setError(null);
    }

    return () => {
      requestIdRef.current += 1;
      destroyCurrentAd();
    };
  }, [adsSupported, destroyCurrentAd, enabled, reload]);

  return { nativeAd, loading, error, reload, adsSupported };
};
