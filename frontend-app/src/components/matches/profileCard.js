import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  MapPin,
  Venus,
  Mars,
  VenusAndMars,
  Ruler,
  MessageCircle,
  User,
} from 'lucide-react';
import PixelClouds from '../profile/components/PixelClouds';
import '../profile/components/pixelTheme.css';
import {
  calculateAge,
  convertHeightForViewer,
  getImageUrl,
  getProfileThemeBackground,
  normalizeImageLayout,
  normalizeProfileStyle,
} from '../profile/utils/profileUtils';
import CompatibilityScore from './compatibilityScore';
import ImageLightboxModal from './imageLightboxModal';
import ViewNoteModal from './viewNoteModal';
import './profileCard.css';

const ProfileCard = ({
  profile,
  userInfo,
  preferredViewerUnit,
  onSkip,
  hideProfileThumbnail = false,
  blendWithBackground = false,
  isStackPreview = false,
  stackPreviewAligned = false,
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const carouselRef = useRef(null);

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
    [sortedImages, API_BASE_URL]
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
    if (g === 'female' || g === 'woman') return Venus;
    if (g === 'male' || g === 'man') return Mars;
    return VenusAndMars;
  };

  const hasMatchmakerMediation = Boolean(
    profile?.matched_by_matcher ||
      profile?.matched_by_matcher_user_1 ||
      profile?.matched_by_matcher_user_2
  );
  const noteAuthorLabel = hasMatchmakerMediation ? 'Matchmaker' : 'Dater';

  const canSkipProfile = ['matchmaker', 'user', 'dater'].includes(userInfo?.role);
  const showCompatibility =
    profile?.ai_score !== undefined && profile?.ai_score !== null;
  const imageLayout = normalizeImageLayout(profile?.imageLayout);
  const profileStyle = normalizeProfileStyle(profile?.profileStyle);
  const themeBackgroundColor = getProfileThemeBackground(
    profile?.profileStyle || 'classic'
  );
  const isHeroStackLayout = imageLayout === 'heroStack' && imageUris.length > 0;
  const isVerticalLayout = imageLayout === 'vertical' && imageUris.length > 0;
  const isDaterView = userInfo?.role === 'user';
  const accentColor = isDaterView ? '#ef4d73' : '#6c5ce7';
  const tagBackgroundColor = isDaterView ? '#ffe8ee' : '#efe7ff';
  const tagBorderColor = isDaterView ? '#ffd6e3' : '#ddd6fe';
  const seeNoteTagBackgroundColor = isDaterView
    ? 'rgba(255, 232, 238, 0.82)'
    : 'rgba(239, 231, 255, 0.82)';
  const selectedImageUri = imageUris[photoIndex] || imageUris[0] || null;
  const hasNote = Boolean(profile.note?.trim());
  const GenderIcon = getGenderIcon();

  const openLightbox = (index) => {
    if (imageUris.length === 0) return;
    setLightboxIndex(index >= 0 ? index : 0);
  };

  useEffect(() => {
    setLightboxIndex(null);
    setShowNoteModal(false);
    setPhotoIndex(0);
    if (carouselRef.current) {
      carouselRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }
  }, [profile?.id]);

  const handleCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el || el.clientWidth === 0) return;
    const nextIndex = Math.round(el.scrollLeft / el.clientWidth);
    setPhotoIndex(Math.min(Math.max(nextIndex, 0), imageUris.length - 1));
  };

  const renderSeeNoteTag = (interactive = true) => {
    if (!hasNote) return null;

    const tagClassName = `pc-see-note-tag${
      isStackPreview ? ' pc-see-note-tag-stack-preview' : ''
    }`;

    if (!interactive || isStackPreview) {
      return (
        <div
          className={tagClassName}
          style={{
            backgroundColor: seeNoteTagBackgroundColor,
            borderColor: tagBorderColor,
            color: accentColor,
          }}
          aria-hidden="true"
        >
          <MessageCircle size={12} color={accentColor} />
          <span>See note</span>
        </div>
      );
    }

    return (
      <button
        type="button"
        className={tagClassName}
        style={{
          backgroundColor: seeNoteTagBackgroundColor,
          borderColor: tagBorderColor,
          color: accentColor,
        }}
        onClick={() => setShowNoteModal(true)}
        aria-label="See note"
      >
        <MessageCircle size={12} color={accentColor} />
        <span>See note</span>
      </button>
    );
  };

  const renderImageOverlays = () => (
    <>
      {!isStackPreview && showCompatibility && (
        <div className="pc-compatibility-badge">
          <CompatibilityScore score={profile.ai_score} variant="overlay" />
        </div>
      )}

      {!isStackPreview && canSkipProfile && onSkip && (
        <button
          type="button"
          className="pc-close-button"
          onClick={onSkip}
          aria-label="Skip profile"
        >
          <span className="pc-close-button-inner">
            <X size={18} color="#ffffff" />
          </span>
        </button>
      )}

      {!isVerticalLayout && renderSeeNoteTag(!isStackPreview)}
    </>
  );

  const renderCarouselImages = () => (
    <>
      <div
        className="pc-carousel"
        ref={carouselRef}
        onScroll={handleCarouselScroll}
      >
        {imageUris.map((uri, index) => (
          <button
            key={`${uri}-${index}`}
            type="button"
            className="pc-carousel-slide"
            onClick={() => openLightbox(index)}
            aria-label="Enlarge photo"
          >
            <img src={uri} alt="" className="pc-hero-image" />
          </button>
        ))}
      </div>

      {imageUris.length > 1 && (
        <div className="pc-pagination-wrap">
          <div className="pc-pagination-pill">
            {imageUris.map((_, index) => (
              <span
                key={`dot-${index}`}
                className={`pc-dot ${index === photoIndex ? 'pc-dot-active' : ''}`}
                style={
                  index === photoIndex ? { backgroundColor: accentColor } : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </>
  );

  const renderVerticalImages = () => (
    <div className="pc-vertical-container">
      {imageUris.map((uri, index) => (
        <div
          key={`${uri}-${index}`}
          className="pc-vertical-image-wrap"
          style={{ backgroundColor: themeBackgroundColor }}
        >
          <button
            type="button"
            className="pc-vertical-image-button"
            onClick={() => openLightbox(index)}
            aria-label={`Enlarge photo ${index + 1}`}
          >
            <img src={uri} alt="" className="pc-vertical-image" />
          </button>
          {index === 0 && renderSeeNoteTag()}
        </div>
      ))}
    </div>
  );

  const renderHeroStackImages = () => (
    <div className="pc-hero-stack">
      <button
        type="button"
        className="pc-hero-stack-main"
        onClick={() => openLightbox(photoIndex)}
        aria-label="Enlarge photo"
      >
        {selectedImageUri && (
          <img src={selectedImageUri} alt="" className="pc-hero-stack-main-image" />
        )}
      </button>

      {imageUris.length > 1 && (
        <div
          className="pc-hero-stack-thumbs"
          style={{ backgroundColor: themeBackgroundColor }}
        >
          {imageUris.map((uri, index) => {
            const isSelected = index === photoIndex;
            return (
              <button
                key={`${uri}-${index}`}
                type="button"
                className="pc-hero-stack-thumb"
                style={{
                  borderColor: isSelected ? accentColor : themeBackgroundColor,
                }}
                onClick={() => setPhotoIndex(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-pressed={isSelected}
              >
                <img src={uri} alt="" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const isDaterAccent = isDaterView;
  const blendBorderColor = isDaterAccent
    ? 'rgba(239, 77, 115, 0.08)'
    : 'rgba(108, 92, 231, 0.08)';

  return (
    <div
      className={`pc-card-outer${blendWithBackground ? ' pc-card-outer-blended' : ''}${
        isStackPreview ? ' pc-card-outer-stack-preview' : ''
      }`}
    >
      <div
        className={`pc-card pc-theme-${profileStyle}${blendWithBackground ? ' pc-card-blended' : ''}${
          isStackPreview ? ' pc-card-stack-preview' : ''
        }`}
        style={{
          backgroundColor: themeBackgroundColor,
          ...(blendWithBackground ? { borderColor: blendBorderColor } : null),
        }}
      >
        <div className="pc-theme-layer" aria-hidden="true">
          {profileStyle === 'pixelCloud' && <PixelClouds />}
        </div>

        <div className="pc-content-layer">
          <div
            className={`pc-image-section${isVerticalLayout ? ' pc-image-section-vertical' : ''}${
              isHeroStackLayout ? ' pc-image-section-hero-stack' : ''
            }${isStackPreview ? ' pc-image-section-stack-preview-muted' : ''}${
              isStackPreview && stackPreviewAligned
                ? ' pc-image-section-stack-preview-aligned'
                : ''
            }`}
            style={{ backgroundColor: themeBackgroundColor }}
          >
            {imageUris.length > 0 ? (
              isHeroStackLayout ? (
                renderHeroStackImages()
              ) : isVerticalLayout ? (
                renderVerticalImages()
              ) : (
                renderCarouselImages()
              )
            ) : (
              <div
                className="pc-hero-placeholder"
                style={{ backgroundColor: themeBackgroundColor }}
              >
                <User size={64} color="#d1d5db" />
              </div>
            )}

            {renderImageOverlays()}
          </div>

          {!isStackPreview && (
            <>
              <div className="pc-info-section">
                <div
                  className={`pc-user-header${
                    hideProfileThumbnail ? ' pc-user-header-no-avatar' : ''
                  }`}
                >
                  {!hideProfileThumbnail &&
                    (firstImageUri ? (
                      <button
                        type="button"
                        className="pc-thumbnail"
                        onClick={() => openLightbox(0)}
                        aria-label="Enlarge profile photo"
                      >
                        <img src={firstImageUri} alt="" className="pc-thumbnail-image" />
                      </button>
                    ) : (
                      <div className="pc-thumbnail">
                        <span
                          className="pc-thumbnail-fallback"
                          style={{ color: accentColor }}
                        >
                          {(profile.first_name || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    ))}
                  <p
                    className={`pc-name-text${
                      hideProfileThumbnail ? ' pc-name-text-standalone' : ''
                    }`}
                  >
                    {nameLine}
                  </p>
                </div>

                {profile.bio?.trim() ? (
                  <p className="pc-bio-text">{profile.bio.trim()}</p>
                ) : null}

                {(shouldShowLocation || displayGender || displayHeight) && (
                  <div className="pc-tags-row">
                    {shouldShowLocation && (
                      <span
                        className="pc-tag"
                        style={{
                          backgroundColor: tagBackgroundColor,
                          borderColor: tagBorderColor,
                        }}
                      >
                        <MapPin size={14} color={accentColor} />
                        <span className="pc-tag-text">{locationText}</span>
                      </span>
                    )}
                    {displayGender && (
                      <span
                        className="pc-tag"
                        style={{
                          backgroundColor: tagBackgroundColor,
                          borderColor: tagBorderColor,
                        }}
                      >
                        <GenderIcon size={14} color={accentColor} />
                        <span className="pc-tag-text">{displayGender}</span>
                      </span>
                    )}
                    {displayHeight && (
                      <span
                        className="pc-tag"
                        style={{
                          backgroundColor: tagBackgroundColor,
                          borderColor: tagBorderColor,
                        }}
                      >
                        <Ruler size={14} color={accentColor} />
                        <span className="pc-tag-text">{displayHeight}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <ImageLightboxModal
                uris={imageUris}
                index={lightboxIndex}
                onIndexChange={setLightboxIndex}
                onClose={() => setLightboxIndex(null)}
              />

              {showNoteModal && hasNote && (
                <ViewNoteModal
                  note={profile.note}
                  authorLabel={noteAuthorLabel}
                  accentColor={accentColor}
                  onClose={() => setShowNoteModal(false)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;
