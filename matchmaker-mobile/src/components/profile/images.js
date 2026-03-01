import React, { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, ScrollView, Text } from 'react-native';
import { API_BASE_URL } from '../../env';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from './utils/profileUtils';

const ImageGallery = ({ images = [], editing, onDeleteImage, onPlaceholderClick, layout = 'grid' }) => {
  const maxImages = 9;
  const heroStackColumns = 3;
  const heroStackGap = 10;
  const isGrid = layout === 'grid';
  const isTopRow = layout === 'topRow';
  const isHeroStack = layout === 'heroStack';
  const topRowScrollRef = useRef(null);
  const [topRowViewportWidth, setTopRowViewportWidth] = useState(0);
  const [heroStackViewportWidth, setHeroStackViewportWidth] = useState(0);
  const topRowSize = topRowViewportWidth > 0 ? topRowViewportWidth : 280;
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
    isGrid
      ? styles.gridLayout
      : isTopRow
        ? styles.topRowLayout
        : isHeroStack
          ? styles.heroStackLayout
          : styles.verticalLayout,
  ];
  const topRowItemSizeStyle = isTopRow ? { width: topRowSize, height: topRowSize } : null;

  const renderImage = (img, index) => (
    <View
      key={img.id || index}
      style={[
        isGrid
          ? styles.imageWrapper
          : isTopRow
            ? styles.topRowImageWrapper
            : isHeroStack
              ? [
                styles.heroImageWrapper,
                index === 0
                  ? [styles.heroMainWrapper, heroMainSizeStyle]
                  : heroThumbSizeStyle,
              ]
              : styles.listWrapper,
        topRowItemSizeStyle,
      ]}
    >
      <Image
        source={{ uri: getImageUrl(img.image_url, API_BASE_URL) }}
        style={
          isGrid
            ? styles.gridImage
            : isTopRow
              ? styles.topRowImage
              : isHeroStack
                ? [styles.heroImage, index === 0 && styles.heroMainImage]
                : styles.fullImage
        }
        resizeMode="cover"
      />
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

  const renderPlaceholder = () => {
    if (!editing || images.length >= maxImages) return null;
    return (
      <TouchableOpacity
        style={
          isGrid
            ? styles.imagePlaceholder
            : isTopRow
              ? [styles.topRowPlaceholder, topRowItemSizeStyle]
              : isHeroStack
                ? [styles.heroThumbPlaceholder, heroThumbSizeStyle]
              : styles.listPlaceholder
        }
        onPress={onPlaceholderClick}
      >
        <Ionicons name="add" size={32} color="#bbb" />
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    if (isTopRow && !editing && topRowScrollRef.current) {
      topRowScrollRef.current.scrollTo({ x: 0, y: 0, animated: false });
    }
  }, [isTopRow, editing, images.length]);

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
          <ScrollView
            ref={topRowScrollRef}
            horizontal
            pagingEnabled
            snapToInterval={topRowSize}
            snapToAlignment="start"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={containerStyle}
          >
            {images.map(renderImage)}
            {renderPlaceholder()}
          </ScrollView>
        </View>
        {editing && (
          <View pointerEvents="none" style={styles.scrollHint}>
            <Text style={styles.scrollHintText}>scroll to add</Text>
            <Ionicons name="arrow-forward" size={24} color="#6c5ce7" />
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
  listPlaceholder: {
    width: '100%',
    maxWidth: 250,
    height: 200,
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#bbb',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  gridLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  verticalLayout: {
    flexDirection: 'column',
    gap: 8,
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
  imageWrapper: {
    position: 'relative',
    width: '31%',
    aspectRatio: 1,
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
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  fullImage: {
    width: '100%',
    maxWidth: 250,
    height: 200,
    borderRadius: 8,
    alignSelf: 'center',
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
  imagePlaceholder: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#fafafa',
    borderWidth: 2,
    borderColor: '#bbb',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
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
