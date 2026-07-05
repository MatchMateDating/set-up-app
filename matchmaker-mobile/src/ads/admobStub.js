/** Safe no-op stub used when AdMob is disabled in Metro config. */
const noop = () => Promise.resolve();

module.exports = {
  default: () => ({
    initialize: noop,
  }),
  TestIds: {
    NATIVE: 'ca-app-pub-3940256099942544/2247696110',
  },
  NativeAd: {
    createForAdRequest: () => Promise.reject(new Error('AdMob disabled')),
  },
  NativeMediaAspectRatio: {
    PORTRAIT: 1,
  },
  NativeAdView: () => null,
  NativeAsset: () => null,
  NativeAssetType: {},
  NativeMediaView: () => null,
};
