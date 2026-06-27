import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NativeAd,
  NativeMediaAspectRatio,
} from 'react-native-google-mobile-ads';
import { getNativeAdUnitId } from './adConfig';

export const useNativeAd = ({ enabled = true } = {}) => {
  const [nativeAd, setNativeAd] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const nativeAdRef = useRef(null);
  const requestIdRef = useRef(0);

  const destroyCurrentAd = useCallback(() => {
    if (nativeAdRef.current) {
      nativeAdRef.current.destroy();
      nativeAdRef.current = null;
    }
    setNativeAd(null);
  }, []);

  const reload = useCallback(() => {
    if (!enabled) {
      destroyCurrentAd();
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    destroyCurrentAd();
    setLoading(true);
    setError(null);

    NativeAd.createForAdRequest(getNativeAdUnitId(), {
      aspectRatio: NativeMediaAspectRatio.PORTRAIT,
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
  }, [destroyCurrentAd, enabled]);

  useEffect(() => {
    if (enabled) {
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
  }, [destroyCurrentAd, enabled, reload]);

  return { nativeAd, loading, error, reload };
};
