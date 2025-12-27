import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { API_BASE_URL } from '@env';
import { Ionicons } from '@expo/vector-icons';

const ImageGallery = ({ images = [], editing, onDeleteImage, onPlaceholderClick, layout = 'grid' }) => {
  const maxImages = 9;
//  const placeholdersNeeded = Math.max(0, maxImages - images.length);

  return (
    <View style={[styles.imageGallery, layout === 'grid' ? styles.gridLayout : styles.verticalLayout]}>
      {images.map((img, index) => (
        <View key={img.id || index} style={layout === 'grid' ? styles.imageWrapper : styles.listWrapper}>
          <Image
            source={{ uri: `${API_BASE_URL}${img.image_url}` }}
            style={layout === 'grid' ? styles.gridImage : styles.fullImage}
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
      ))}

      {editing && images.length < maxImages && (
        <TouchableOpacity
          style={
            layout === 'grid'
              ? styles.imagePlaceholder
              : styles.listPlaceholder
          }
          onPress={onPlaceholderClick}
        >
          <Ionicons name="add" size={32} color="#bbb" />
        </TouchableOpacity>
      )}
    </View>
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
  imageWrapper: {
    position: 'relative',
    width: '31%',
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
});

export default ImageGallery;
