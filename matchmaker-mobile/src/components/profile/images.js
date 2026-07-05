import React, { useRef, useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text, Pressable } from 'react-native';
import { API_BASE_URL } from '../../env';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl, normalizeImageLayout } from './utils/profileUtils';
import HorizontalPhotoScrollView from './components/HorizontalPhotoScrollView';

const ImageGallery = ({
  images = [],
  editing,
  onDeleteImage,
  onPlaceholderClick,
  onImagePress,
  layout = 'topRow',
  accentColor = '#6c5ce7',
  surfaceColor = '#fafafa',
  surfaceBorderColor = '#bbb',
}) => {
  const resolvedLayout = normalizeImageLayout(layout);
  const placeholderSurfaceStyle = { backgroundColor: surfaceColor };
  const listSurfaceStyle = { backgroundColor: surfaceColor };
  const placeholderBorderStyle = { borderColor: surfaceBorderColor };
  const maxImages = 9;
  const heroStackColumns = 3;
  const heroStackGap = 10;
  const isTopRow = resolvedLayout === 'topRow';
  const isHeroStack = resolvedLayout === 'heroStack';
  const isVertical = !isTopRow && !isHeroStack;
  const topRowScrollRef = useRef(null);
  const [topRowViewportWidth, setTopRowViewportWidth] = useState(0);
  const [topRowPhotoIndex, setTopRowPhotoIndex] = useState(0);
  const [heroStackViewportWidth, setHeroStackViewportWidth] = useState(0);
  const topRowSize = topRowViewportWidth > 0 ? topRowViewportWidth : 280;
  const verticalItemSizeStyle = isVertical ? styles.verticalItemFullWidth : null;
  const heroThumbSize =
    heroStackViewportWidth > 0
      ? Math.floor((heroStackViewportWidth - heroStackGap * (heroStackColumns - 1)) / heroStackColumns)
      : null;
  const heroThumbSizeStyle = isHeroStack && heroThumbSize ? { width: heroThumbSize, height: heroThumbSize } : null;
  const heroMainSizeStyle =
    isHeroStack && heroStackViewportWidth > 0
      ? { width: heroStackViewportWidth, height: heroStackViewportWidth }
      : null;
  const containerStyle = [
    styles.imageGallery,
    isTopRow
      ? styles.topRowLayout
      : isHeroStack
        ? styles.heroStackLayout
        : styles.verticalLayout,
  ];
  const topRowItemSizeStyle = isTopRow ? { width: topRowSize, height: topRowSize } : null;

  const renderImage = (img, index) => {
    const uri = getImageUrl(img.image_url, API_BASE_URL);
    const imageStyle = isTopRow
      ? styles.topRowImage
      : isHeroStack
        ? [styles.heroImage, index === 0 && styles.heroMainImage]
        : styles.fullImageFullWidth;
    const resizeMode = isTopRow || isHeroStack || isVertical ? 'cover' : 'contain';
    const imageEl = (
      <Image source={{ uri }} style={imageStyle} resizeMode={resizeMode} />
    );
    const canPreview = Boolean(onImagePress) && !editing;

    return (
      <View
        key={img.id || index}
        style={[
          isTopRow
            ? styles.topRowImageWrapper
            : isHeroStack
              ? [
                  styles.heroImageWrapper,
                  index === 0 ? [styles.heroMainWrapper, heroMainSizeStyle] : heroThumbSizeStyle,
                ]
              : [styles.listWrapperFullWidth, listSurfaceStyle, verticalItemSizeStyle],
          topRowItemSizeStyle,
        ]}
      >
        {canPreview ? (
          <Pressable
            style={styles.imagePressable}
            onPress={() => onImagePress(uri)}
            accessibilityRole="button"
            accessibilityLabel="Enlarge photo"
          >
            {imageEl}
          </Pressable>
        ) : (
          imageEl
        )}
        {editing && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDeleteImage(img.id)}
          >
            <Ionicons name="close-circle" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderPlaceholder = () => {
    if (!editing || images.length >= maxImages) return null;

    if (isVertical) {
      return (
        <View
          style={[
            styles.listPlaceholderFullWidth,
            verticalItemSizeStyle,
            placeholderSurfaceStyle,
            placeholderBorderStyle,
          ]}
        >
          <TouchableOpacity
            style={styles.verticalPlaceholderTouchable}
            onPress={onPlaceholderClick}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
          >
            <Ionicons name="add" size={32} color="#bbb" />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={
          isTopRow
            ? [styles.topRowPlaceholder, topRowItemSizeStyle, placeholderSurfaceStyle, placeholderBorderStyle]
            : [styles.heroThumbPlaceholder, heroThumbSizeStyle, placeholderSurfaceStyle, placeholderBorderStyle]
        }
        onPress={onPlaceholderClick}
      >
        <Ionicons name="add" size={32} color="#bbb" />
      </TouchableOpacity>
    );
  };

  const topRowResetKey = `${images.length}-${editing}-${topRowViewportWidth}`;

  return (
    isTopRow ? (
      <View style={styles.topRowWrapper}>
        <View
          style={styles.topRowViewport}
          onLayout={(event) => {
            const nextWidth = Math.floor(event.nativeEvent.layout.width);
            if (nextWidth > 0 && nextWidth !== topRowViewportWidth) {
              setTopRowViewportWidth(nextWidth);
            }
          }}
        >
          <HorizontalPhotoScrollView
            ref={topRowScrollRef}
            itemWidth={topRowViewportWidth > 0 ? topRowViewportWidth : topRowSize}
            resetKey={topRowResetKey}
            onIndexChange={setTopRowPhotoIndex}
            style={styles.topRowScrollView}
            contentContainerStyle={containerStyle}
          >
            {images.map(renderImage)}
            {renderPlaceholder()}
          </HorizontalPhotoScrollView>

          {!editing && images.length > 1 ? (
            <View style={styles.paginationWrap} pointerEvents="none">
              <View style={styles.paginationPill}>
                {images.map((_, index) => (
                  <View
                    key={`dot-${index}`}
                    style={[
                      styles.dot,
                      index === topRowPhotoIndex
                        ? [styles.dotActive, { backgroundColor: accentColor }]
                        : styles.dotInactive,
                    ]}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
        {editing && (
          <View pointerEvents="none" style={styles.scrollHint}>
            <Text style={[styles.scrollHintText, { color: accentColor }]}>scroll to add</Text>
            <Ionicons name="arrow-forward" size={24} color={accentColor} />
          </View>
        )}
      </View>
    ) : (
      <View
        style={containerStyle}
        onLayout={
          isHeroStack
            ? (event) => {
                const nextWidth = Math.floor(event.nativeEvent.layout.width);
                if (nextWidth > 0 && nextWidth !== heroStackViewportWidth) {
                  setHeroStackViewportWidth(nextWidth);
                }
              }
            : undefined
        }
      >
        {images.map(renderImage)}
        {renderPlaceholder()}
      </View>
    )
  );
};

const styles = StyleSheet.create({
  imageGallery: {
    marginTop: 12,
  },
  imagePressable: {
    width: '100%',
    height: '100%',
  },
  listPlaceholder: {
    width: '100%',
    maxWidth: 250,
    aspectRatio: 1,
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#bbb',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  listPlaceholderFullWidth: {
    width: '100%',
    aspectRatio: 1,
    alignSelf: 'center',
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#bbb',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  verticalItemFullWidth: {
    width: '100%',
    aspectRatio: 1,
    alignSelf: 'center',
  },
  verticalPlaceholderTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalLayout: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    alignSelf: 'stretch',
  },
  heroStackLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topRowLayout: {
    flexDirection: 'row',
    gap: 0,
  },
  topRowViewport: {
    width: '100%',
    position: 'relative',
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
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
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
  topRowScrollView: {
    width: '100%',
  },
  scrollHint: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scrollHintText: {
    color: '#6c5ce7',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  topRowWrapper: {
    width: '100%',
  },
  topRowImageWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  heroImageWrapper: {
    position: 'relative',
    width: '31%',
    aspectRatio: 1,
  },
  heroMainWrapper: {
    width: '100%',
    aspectRatio: 1,
  },
  listWrapper: {
    width: '100%',
    maxWidth: 250,
    height: 200,
    alignSelf: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    overflow: 'hidden',
  },
  listWrapperFullWidth: {
    width: '100%',
    aspectRatio: 1,
    alignSelf: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    overflow: 'hidden',
  },
  fullImage: {
    width: '100%',
    maxWidth: 250,
    height: 200,
    borderRadius: 8,
    alignSelf: 'center',
  },
  fullImageFullWidth: {
    width: '100%',
    height: '100%',
    alignSelf: 'stretch',
    borderRadius: 12,
  },
  topRowImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  heroMainImage: {
    borderRadius: 14,
  },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 0, 0, 0.75)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRowPlaceholder: {
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#bbb',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  heroMainPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#bbb',
    borderStyle: 'dashed',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroThumbPlaceholder: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#bbb',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ImageGallery;
