import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import HorizontalPhotoScrollView from '../profile/components/HorizontalPhotoScrollView';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../env';
import {
  calculateAge,
  convertHeightForViewer,
  getImageUrl,
} from '../profile/utils/profileUtils';
import CompatibilityScore from './compatibilityScore';
import ImageLightboxModal from '../profile/components/ImageLightboxModal';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 20;
const IMAGE_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
const IMAGE_HEIGHT = Math.round(IMAGE_WIDTH * 0.95);
const HERO_STACK_MAIN_HEIGHT = Math.round(IMAGE_WIDTH * 0.88);
const HERO_STACK_THUMB_GAP = 8;
const HERO_STACK_THUMB_PADDING = 12;
const HERO_STACK_MAX_THUMB_SIZE = 64;
/** Visible hero strip when previewing a card behind another noted card. */
const STACK_ALIGNED_CARD_TOP_HEIGHT = 48;

const ProfileCard = ({
  profile,
  userInfo,
  preferredViewerUnit,
  onSkip,
  isStackPreview = false,
  stackPreviewAligned = false,
  // Optional; ignored (no “Linked dater” UI). Keeps older bundles / callers stable.
  isLinkedDater = false,
}) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const scrollRef = useRef(null);

  const viewerUnit = preferredViewerUnit || userInfo?.unit;

  const sortedImages = useMemo(
    () => [...(profile?.images || [])].sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0)),
    [profile?.images]
  );

  const imageUris = useMemo(
    () =>
      sortedImages
        .map((img) => (img?.image_url ? getImageUrl(img.image_url, API_BASE_URL) : null))
        .filter(Boolean),
    [sortedImages]
  );

  const firstImageUri = profile?.images?.[0]?.image_url
    ? getImageUrl(profile.images[0].image_url, API_BASE_URL)
    : imageUris[0] || null;
  const age = profile?.birthdate ? calculateAge(profile.birthdate) : null;
  const nameLine = age
    ? `${profile.first_name || ''}, ${age}`
    : profile.first_name || '';

  const displayHeight = (
    convertHeightForViewer(profile.height, profile.unit, viewerUnit) ||
    profile.height ||
    ''
  ).trim();

  const displayGender = (profile.gender || '').trim();

  const locationText = [profile.city, profile.state].filter(Boolean).join(', ');
  const shouldShowLocation = Boolean(profile.show_location && locationText);

  const getGenderIcon = () => {
    const g = displayGender.toLowerCase();
    if (g === 'female' || g === 'woman') return 'female';
    if (g === 'male' || g === 'man') return 'male';
    return 'male-female-outline';
  };

  const hasMatchmakerMediation = Boolean(
    profile?.matched_by_matcher ||
    profile?.matched_by_matcher_user_1 ||
    profile?.matched_by_matcher_user_2
  );

  const canSkipProfile = ['matchmaker', 'user', 'dater'].includes(userInfo?.role);
  const showCompatibility = profile?.ai_score !== undefined && profile?.ai_score !== null;
  const isHeroStackLayout = profile?.imageLayout === 'heroStack' && imageUris.length > 0;
  const isDaterView = userInfo?.role === 'user';
  const accentColor = isDaterView ? '#ef4d73' : '#6c5ce7';
  const tagBackgroundColor = isDaterView ? '#ffe8ee' : '#efe7ff';
  const tagBorderColor = isDaterView ? '#ffd6e3' : '#ddd6fe';
  const heroStackSelectedBorderColor = accentColor;
  const heroStackThumbSize =
    imageUris.length > 1 ? HERO_STACK_MAX_THUMB_SIZE : 0;
  const heroStackThumbRowWidth =
    imageUris.length > 1
      ? imageUris.length * heroStackThumbSize +
        (imageUris.length - 1) * HERO_STACK_THUMB_GAP
      : 0;
  const heroStackThumbsScrollable = heroStackThumbRowWidth > IMAGE_WIDTH;
  const heroStackSectionHeight =
    HERO_STACK_MAIN_HEIGHT +
    (isHeroStackLayout && imageUris.length > 1
      ? heroStackThumbSize + HERO_STACK_THUMB_PADDING * 2
      : 0);
  const selectedImageUri = imageUris[photoIndex] || imageUris[0] || null;

  const openLightbox = (index) => {
    if (imageUris.length === 0) return;
    setLightboxIndex(index >= 0 ? index : 0);
  };

  useEffect(() => {
    setLightboxIndex(null);
    setPhotoIndex(0);
    if (!isHeroStackLayout) {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [profile?.id, isHeroStackLayout]);

  const renderNoteSlot = () => {
    const hasNote = Boolean(profile.note?.trim());
    if (!hasNote) return null;

    const noteBubbleStyles = [
      styles.noteBubble,
      styles.noteBubbleInCard,
      isStackPreview && styles.noteBubbleStackPreview,
    ];
    const labelStyles = [
      styles.noteLabel,
      isStackPreview && styles.noteLabelStackPreview,
    ];
    const textStyles = [
      styles.noteText,
      isStackPreview && styles.noteTextStackPreview,
    ];

    if (isStackPreview && !stackPreviewAligned) {
      return (
        <View style={styles.noteWrapperInCard}>
          <View style={noteBubbleStyles}>
            <Text style={labelStyles}>
              {hasMatchmakerMediation ? 'Matchmaker' : 'Note'}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.noteWrapperInCard}>
        <View style={noteBubbleStyles}>
          <Text style={[labelStyles, styles.noteLabelSpacing]}>
            {hasMatchmakerMediation ? 'Matchmaker' : 'Note'}
          </Text>
          <Text
            style={textStyles}
            numberOfLines={isStackPreview && stackPreviewAligned ? 3 : undefined}
          >
            {profile.note}
          </Text>
        </View>
      </View>
    );
  };

  const renderImageOverlays = () => {
    if (isStackPreview) return null;
    return (
    <>
      {showCompatibility ? (
        <View style={styles.compatibilityBadge}>
          <CompatibilityScore score={profile.ai_score} variant="overlay" />
        </View>
      ) : null}

      {canSkipProfile && onSkip ? (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onSkip}
          accessibilityLabel="Skip profile"
        >
          <View style={styles.closeButtonInner}>
            <Ionicons name="close" size={18} color="#ffffff" />
          </View>
        </TouchableOpacity>
      ) : null}
    </>
    );
  };

  const renderCarouselImages = () => (
    <>
      <HorizontalPhotoScrollView
        ref={scrollRef}
        itemWidth={IMAGE_WIDTH}
        resetKey={profile?.id}
        onIndexChange={setPhotoIndex}
      >
        {imageUris.map((uri, index) => (
          <TouchableOpacity
            key={`${uri}-${index}`}
            activeOpacity={0.92}
            onPress={() => openLightbox(index)}
            accessibilityRole="button"
            accessibilityLabel="Enlarge photo"
          >
            <Image source={{ uri }} style={styles.heroImage} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </HorizontalPhotoScrollView>

      {imageUris.length > 1 ? (
        <View style={styles.paginationWrap}>
          <View style={styles.paginationPill}>
            {imageUris.map((_, index) => (
              <View
                key={`dot-${index}`}
                style={[
                  styles.dot,
                  index === photoIndex ? [styles.dotActive, { backgroundColor: accentColor }] : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );

  const renderHeroStackImages = () => (
    <View style={styles.heroStackContainer}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => openLightbox(photoIndex)}
        accessibilityRole="button"
        accessibilityLabel="Enlarge photo"
        style={styles.heroStackMainTouchable}
      >
        {selectedImageUri ? (
          <Image
            source={{ uri: selectedImageUri }}
            style={styles.heroStackMainImage}
            resizeMode="cover"
          />
        ) : null}
      </TouchableOpacity>

      {imageUris.length > 1 ? (
        <View style={styles.heroStackThumbRowBackground}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={heroStackThumbsScrollable}
            contentContainerStyle={[
              styles.heroStackThumbRow,
              !heroStackThumbsScrollable && styles.heroStackThumbRowCentered,
            ]}
          >
          {imageUris.map((uri, index) => {
            const isSelected = index === photoIndex;
            return (
              <TouchableOpacity
                key={`${uri}-${index}`}
                activeOpacity={0.85}
                onPress={() => setPhotoIndex(index)}
                accessibilityRole="button"
                accessibilityLabel={`Show photo ${index + 1}`}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.heroStackThumbWrap,
                  {
                    width: heroStackThumbSize,
                    height: heroStackThumbSize,
                    borderColor: isSelected
                      ? heroStackSelectedBorderColor
                      : '#ffffff',
                  },
                ]}
              >
                <Image
                  source={{ uri }}
                  style={styles.heroStackThumbImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            );
          })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );

  const hasNote = Boolean(profile.note?.trim());
  const isNoteOnlyPreview = isStackPreview && hasNote && !stackPreviewAligned;
  const showNoteInCard = hasNote && (!isStackPreview || stackPreviewAligned || isNoteOnlyPreview);

  const renderInfoSection = () => (
    <View style={styles.infoSection}>
      <View style={styles.userHeader}>
        {firstImageUri ? (
          isStackPreview ? (
            <View style={styles.thumbnail}>
              <Image
                source={{ uri: firstImageUri }}
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.thumbnail}
              activeOpacity={0.85}
              onPress={() => openLightbox(0)}
              accessibilityRole="button"
              accessibilityLabel="Enlarge profile photo"
            >
              <Image
                source={{ uri: firstImageUri }}
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )
        ) : (
          <View style={styles.thumbnail}>
            <Text style={[styles.thumbnailFallback, { color: accentColor }]}>
              {(profile.first_name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.nameText}>{nameLine}</Text>
      </View>

      {profile.bio?.trim() ? (
        <Text style={styles.bioText}>{profile.bio.trim()}</Text>
      ) : null}

      {(shouldShowLocation || displayGender || displayHeight) ? (
        <View style={styles.tagsRow}>
          {shouldShowLocation ? (
            <View style={[styles.tag, { backgroundColor: tagBackgroundColor, borderColor: tagBorderColor }]}>
              <Ionicons name="location-outline" size={14} color={accentColor} />
              <Text style={styles.tagText} numberOfLines={1}>
                {locationText}
              </Text>
            </View>
          ) : null}
          {displayGender ? (
            <View style={[styles.tag, { backgroundColor: tagBackgroundColor, borderColor: tagBorderColor }]}>
              <Ionicons name={getGenderIcon()} size={14} color={accentColor} />
              <Text style={styles.tagText}>{displayGender}</Text>
            </View>
          ) : null}
          {displayHeight ? (
            <View style={[styles.tag, { backgroundColor: tagBackgroundColor, borderColor: tagBorderColor }]}>
              <Ionicons name="resize-outline" size={14} color={accentColor} />
              <Text style={styles.tagText}>{displayHeight}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const cardContent = (
    <View style={[styles.cardOuter, isStackPreview && styles.cardOuterStackPreview]}>
      <View
        style={[styles.card, isStackPreview && styles.cardStackPreview]}
      >
        {showNoteInCard ? renderNoteSlot() : null}

        {!isNoteOnlyPreview ? (
          <>
            <View
              style={[
                styles.imageSection,
                showNoteInCard && styles.imageSectionBelowNote,
                isStackPreview && stackPreviewAligned && styles.imageSectionStackPreviewAligned,
                isStackPreview && !isNoteOnlyPreview && styles.imageSectionStackPreviewMuted,
                isHeroStackLayout &&
                  !stackPreviewAligned && { height: heroStackSectionHeight },
              ]}
            >
              {imageUris.length > 0 ? (
                isHeroStackLayout ? renderHeroStackImages() : renderCarouselImages()
              ) : (
                <View style={styles.heroPlaceholder}>
                  <Ionicons name="person" size={64} color="#d1d5db" />
                </View>
              )}

              {renderImageOverlays()}
            </View>

            {!isStackPreview ? (
              <>
                {renderInfoSection()}
                <ImageLightboxModal
                  uris={imageUris}
                  index={lightboxIndex}
                  onIndexChange={setLightboxIndex}
                  onClose={() => setLightboxIndex(null)}
                />
              </>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );

  return cardContent;
};

const styles = StyleSheet.create({
  cardOuter: {
    marginBottom: 12,
  },
  cardOuterStackPreview: {
    marginBottom: 0,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  cardStackPreview: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  noteBubbleStackPreview: {
    backgroundColor: '#f3f4f6',
    shadowOpacity: 0.04,
  },
  noteLabelStackPreview: {
    color: '#9ca3af',
  },
  noteTextStackPreview: {
    color: '#9ca3af',
  },
  imageSectionStackPreviewMuted: {
    opacity: 0.55,
  },
  imageSectionStackPreviewAligned: {
    height: STACK_ALIGNED_CARD_TOP_HEIGHT,
    maxHeight: STACK_ALIGNED_CARD_TOP_HEIGHT,
    overflow: 'hidden',
  },
  noteWrapperInCard: {
    backgroundColor: '#ffffff',
  },
  noteBubble: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  noteBubbleInCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  imageSectionBelowNote: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#ef4d73',
    textTransform: 'uppercase',
  },
  noteLabelSpacing: {
    marginBottom: 6,
  },
  noteText: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 21,
  },
  imageSection: {
    width: '100%',
    height: IMAGE_HEIGHT,
    backgroundColor: '#f3f4f6',
    position: 'relative',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  heroImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  },
  heroStackContainer: {
    width: '100%',
    flex: 1,
  },
  heroStackMainTouchable: {
    width: IMAGE_WIDTH,
    height: HERO_STACK_MAIN_HEIGHT,
  },
  heroStackMainImage: {
    width: '100%',
    height: '100%',
  },
  heroStackThumbRowBackground: {
    width: '100%',
    backgroundColor: '#ffffff',
  },
  heroStackThumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HERO_STACK_THUMB_GAP,
    paddingHorizontal: HERO_STACK_THUMB_PADDING,
    paddingVertical: HERO_STACK_THUMB_PADDING,
  },
  heroStackThumbRowCentered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  heroStackThumbWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
  },
  heroStackThumbImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  compatibilityBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
  },
  closeButtonInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(55, 65, 81, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationWrap: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  paginationPill: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotInactive: {
    backgroundColor: '#9ca3af',
  },
  dotActive: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
    backgroundColor: '#f3e8ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: {
    fontSize: 16,
    fontWeight: '700',
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
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
});

export default ProfileCard;
