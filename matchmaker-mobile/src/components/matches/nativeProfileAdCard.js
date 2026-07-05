import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAdMobModule } from '../../ads/admobModule';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 20;
const IMAGE_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
const IMAGE_HEIGHT = Math.round(IMAGE_WIDTH * 0.95);

const NativeProfileAdCard = ({
  nativeAd,
  userInfo,
  onDismiss,
  loading = false,
  isStackPreview = false,
}) => {
  const isDaterView = userInfo?.role === 'user';
  const accentColor = isDaterView ? '#ef4d73' : '#6c5ce7';
  const tagBackgroundColor = isDaterView ? '#ffe8ee' : '#efe7ff';
  const tagBorderColor = isDaterView ? '#ffd6e3' : '#ddd6fe';
  const cardSurfaceColor = '#ffffff';

  const renderDismissButton = () =>
    !isStackPreview && onDismiss ? (
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onDismiss}
        accessibilityLabel="Dismiss ad"
        hitSlop={8}
      >
        <View style={styles.closeButtonInner}>
          <Ionicons name="close" size={18} color="#ffffff" />
        </View>
      </TouchableOpacity>
    ) : null;

  if (loading || !nativeAd) {
    if (isStackPreview) {
      return null;
    }

    return (
      <View style={styles.adCardWrapper}>
        <View style={styles.cardOuter}>
          <View style={[styles.card, { backgroundColor: cardSurfaceColor }]}>
            <View style={[styles.imageSection, { backgroundColor: cardSurfaceColor }]}>
              <ActivityIndicator size="large" color={accentColor} />
            </View>
            <View style={styles.infoSection}>
              <Text style={styles.loadingText}>Loading sponsored content…</Text>
            </View>
          </View>
        </View>
        {renderDismissButton()}
      </View>
    );
  }

  const admob = getAdMobModule();
  if (!admob) {
    return null;
  }

  const {
    NativeAdView,
    NativeAsset,
    NativeAssetType,
    NativeMediaView,
  } = admob;

  const cardContent = (
    <View
      style={[
        styles.cardOuter,
        isStackPreview && styles.cardOuterStackPreview,
      ]}
    >
      <View style={[styles.card, { backgroundColor: cardSurfaceColor }]}>
        <View style={styles.contentLayer}>
          <View
            style={[
              styles.imageSection,
              { backgroundColor: cardSurfaceColor },
              isStackPreview && styles.imageSectionStackPreviewMuted,
            ]}
          >
            <NativeMediaView
              resizeMode="cover"
              style={styles.heroMedia}
            />

            <View style={styles.sponsoredBadge}>
              <Text style={styles.sponsoredText}>Sponsored</Text>
            </View>
          </View>

          {!isStackPreview ? (
            <View style={styles.infoSection}>
              <View style={styles.userHeader}>
                {nativeAd.icon ? (
                  <NativeAsset assetType={NativeAssetType.ICON}>
                    <Image
                      source={{ uri: nativeAd.icon.url }}
                      style={styles.thumbnailImage}
                    />
                  </NativeAsset>
                ) : (
                  <View style={[styles.thumbnail, { backgroundColor: tagBackgroundColor }]}>
                    <Ionicons name="megaphone-outline" size={18} color={accentColor} />
                  </View>
                )}

                <NativeAsset assetType={NativeAssetType.HEADLINE}>
                  <Text style={styles.nameText} numberOfLines={2}>
                    {nativeAd.headline}
                  </Text>
                </NativeAsset>
              </View>

              {nativeAd.body ? (
                <NativeAsset assetType={NativeAssetType.BODY}>
                  <Text style={styles.bioText} numberOfLines={4}>
                    {nativeAd.body}
                  </Text>
                </NativeAsset>
              ) : null}

              <View style={styles.tagsRow}>
                {nativeAd.advertiser ? (
                  <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                    <Text
                      style={[
                        styles.tagText,
                        styles.tagPill,
                        { backgroundColor: tagBackgroundColor, borderColor: tagBorderColor },
                      ]}
                      numberOfLines={1}
                    >
                      {nativeAd.advertiser}
                    </Text>
                  </NativeAsset>
                ) : null}

                {nativeAd.callToAction ? (
                  <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
                    <Text
                      style={[
                        styles.tagText,
                        styles.tagPill,
                        styles.ctaTagText,
                        { backgroundColor: tagBackgroundColor, borderColor: tagBorderColor, color: accentColor },
                      ]}
                      numberOfLines={1}
                    >
                      {nativeAd.callToAction}
                    </Text>
                  </NativeAsset>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.adCardWrapper}>
      <NativeAdView nativeAd={nativeAd}>{cardContent}</NativeAdView>
      {renderDismissButton()}
    </View>
  );
};

const styles = StyleSheet.create({
  adCardWrapper: {
    position: 'relative',
  },
  cardOuter: {
    marginBottom: 12,
    borderRadius: 24,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  cardOuterStackPreview: {
    marginBottom: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
  },
  contentLayer: {
    position: 'relative',
    zIndex: 1,
  },
  imageSection: {
    width: '100%',
    height: IMAGE_HEIGHT,
    position: 'relative',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageSectionStackPreviewMuted: {
    opacity: 0.55,
  },
  heroMedia: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  },
  sponsoredBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  sponsoredText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 0.3,
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    elevation: 10,
  },
  closeButtonInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(55, 65, 81, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  nameText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  bioText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#111827',
    marginBottom: 14,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  ctaTag: {
    flexShrink: 1,
  },
  ctaTagText: {
    fontWeight: '700',
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  loadingText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default NativeProfileAdCard;
