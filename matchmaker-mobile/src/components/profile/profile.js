import React, { useEffect, useState, useContext, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL } from '../../env';
import { calculateAge, convertFtInToMetersCm, convertMetersCmToFtIn, formatHeight, getImageUrl, convertHeightForViewer } from './utils/profileUtils';
import ProfileInfoCard from './profileInfoCard';
import PixelClouds from './components/PixelClouds';
import PixelFlowers from './components/PixelFlowers';
import PixelCactus from './components/PixelCactus';
import { Ionicons } from '@expo/vector-icons';
import { UserContext } from '../../context/UserContext';
import { getRoleAccentColor } from '../layout/components/RoleHeaderBanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: LIGHTBOX_WIN_W, height: LIGHTBOX_WIN_H } = Dimensions.get('window');

const Profile = ({
  user,
  framed,
  viewerUnit,
  editing,
  setEditing,
  onSave,
  onEditingFormData,
  parentScrollRef,
  parentScrollOffsetYRef,
  onRequestCrop,
  enableImageLightbox = false,
}) => {
  const { setUser } = useContext(UserContext);
  const insets = useSafeAreaInsets();
  /** Index into `lightboxUris` while the image preview is open; `null` when closed. */
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birthdate: '',
    gender: '',
    heightFeet: '0',
    heightInches: '0',
    heightMeters: '0',
    heightCentimeters: '0',
    preferredAgeMin: '0',
    preferredAgeMax: '0',
    preferredGenders: [],
    bio: '',
    fontFamily: 'Arial',
    profileStyle: 'classic',
    imageLayout: 'grid',
    show_location: false
  });

  const [images, setImages] = useState([]);
  const [imageError, setImageError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    first_name: '',
    last_name: '',
    birthdate: '',
    height: '',
  });
  const [heightUnit, setHeightUnit] = useState('ft');
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);
  const scrollOffsetYRef = useRef(0);

  useEffect(() => {
    if (user) {
      if (user.images) {
        setImages(user.images);
        if (user.images.length > 0) setImageError('');
      }

      const baseFormData = {
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        birthdate: user.birthdate || '',
        gender: user.gender || '',
        bio: user.bio || '',
        preferredAgeMin: user.preferredAgeMin || '',
        preferredAgeMax: user.preferredAgeMax || '',
        preferredGenders: user.preferredGenders || [],
        fontFamily: user.fontFamily || 'Arial',
        profileStyle: user.profileStyle || 'classic',
        imageLayout: user.imageLayout || 'grid',
        show_location: user.show_location ?? false
      };

      const heightString = user.height || "0'0";
      if (heightString.includes("'")) {
        const parts = heightString.split(/'|"/);
        const feet = parts[0] || '0';
        const inches = parts[1] || '0';

        setFormData({
          ...baseFormData,
          heightFeet: feet.toString(),
          heightInches: inches.toString(),
          heightMeters: '0',
          heightCentimeters: '0'
        });
        setHeightUnit('ft');
      } else if (heightString.includes('m')) {
        const parts = heightString.split(' ');
        const meters = parts[0] ? parts[0].replace('m', '') : '0';
        const centimeters = parts[1] ? parts[1].replace('cm', '') : '0';

        setFormData({
          ...baseFormData,
          heightFeet: '0',
          heightInches: '0',
          heightMeters: meters,
          heightCentimeters: centimeters
        });
        setHeightUnit('m');
      } else {
        setFormData(baseFormData);
      }
    }
  }, [user]);

  useEffect(() => {
    if (editing && onEditingFormData) {
      onEditingFormData({ formData, handleInputChange });
    } else if (!editing && onEditingFormData) {
      // Clear form data when editing is turned off
      onEditingFormData(null);
    }
  }, [editing, formData, handleInputChange, onEditingFormData]);

  const handlePlaceholderClick = async () => {
    if (!editing) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera roll permissions to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length && onRequestCrop) {
      const uris = result.assets.map((a) => a.uri);
      onRequestCrop(uris, handleCropComplete);
    }
  };

  const handleCropComplete = async (imageAsset) => {
    if (!imageAsset) return;

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('image', {
        uri: imageAsset.uri,
        type: 'image/jpeg',
        name: 'image.jpg',
      });

      const response = await fetch(`${API_BASE_URL}/profile/upload_image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formDataToSend,
      });

      if (response.status === 401) {
        const data = await response.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!response.ok) throw new Error('Failed to upload image');

      const newImage = await response.json();
      setImages((prevImages) => [...prevImages, newImage]);
      setImageError('');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const handleInputChange = useCallback((e) => {
    const name = e.target?.name || e.name;
    const value = e.target?.value !== undefined ? e.target.value : e.value;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };

      setFieldErrors((prevErrors) => {
        const updated = { ...prevErrors };

        if (name === 'first_name' && value?.trim()) updated.first_name = '';
        if (name === 'last_name' && value?.trim()) updated.last_name = '';
        if (name === 'birthdate' && value) updated.birthdate = '';

        const feet = parseInt(next.heightFeet, 10) || 0;
        const inches = parseInt(next.heightInches, 10) || 0;
        const meters = parseInt(next.heightMeters, 10) || 0;
        const centimeters = parseInt(next.heightCentimeters, 10) || 0;
        const hasHeight =
          heightUnit === 'ft'
            ? !(feet === 0 && inches === 0)
            : !(meters === 0 && centimeters === 0);

        if (
          ['heightFeet', 'heightInches', 'heightMeters', 'heightCentimeters'].includes(name) &&
          hasHeight
        ) {
          updated.height = '';
        }

        return updated;
      });

      return next;
    });
  }, [heightUnit]);

  const handleUnitToggle = () => {
    if (heightUnit === 'ft') {
      const { meters, centimeters } = convertFtInToMetersCm(formData.heightFeet, formData.heightInches);
      setFormData((prev) => ({ ...prev, heightMeters: meters, heightCentimeters: centimeters }));
      setHeightUnit('m');
    } else {
      const { feet, inches } = convertMetersCmToFtIn(formData.heightMeters, formData.heightCentimeters);
      setFormData((prev) => ({ ...prev, heightFeet: feet, heightInches: inches }));
      setHeightUnit('ft');
    }
    setFieldErrors((prev) => ({ ...prev, height: '' }));
  };

  const handleFormSubmit = async () => {
    try {
      const nextErrors = {
        first_name: '',
        last_name: '',
        birthdate: '',
        height: '',
      };

      if (!formData.first_name?.trim()) nextErrors.first_name = 'First name is required.';
      if (!formData.last_name?.trim()) nextErrors.last_name = 'Last name is required.';
      if (!formData.birthdate) nextErrors.birthdate = 'Please select your birthdate.';

      const feet = parseInt(formData.heightFeet, 10) || 0;
      const inches = parseInt(formData.heightInches, 10) || 0;
      const meters = parseInt(formData.heightMeters, 10) || 0;
      const centimeters = parseInt(formData.heightCentimeters, 10) || 0;
      const hasHeight =
        heightUnit === 'ft'
          ? !(feet === 0 && inches === 0)
          : !(meters === 0 && centimeters === 0);
      if (!hasHeight) nextErrors.height = 'Please select your height.';

      setFieldErrors(nextErrors);
      if (Object.values(nextErrors).some(Boolean)) return;

      const hasAtLeastOneImage = images.some((img) => Boolean(img?.image_url || img?.uri));
      if (!hasAtLeastOneImage) {
        setImageError('Please upload at least one image.');
        return;
      }
      setImageError('');

      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const heightFormatted = formatHeight(formData, heightUnit);

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birthdate: formData.birthdate,
        gender: formData.gender,
        bio: (formData.bio || '').trim().slice(0, 100),
        height: heightFormatted,
        preferredAgeMin: formData.preferredAgeMin,
        preferredAgeMax: formData.preferredAgeMax,
        preferredGenders: formData.preferredGenders,
        fontFamily: formData.fontFamily,
        profileStyle: formData.profileStyle,
        imageLayout: formData.imageLayout,
        show_location: formData.show_location,
        unit: heightUnit === 'ft' ? 'imperial' : 'metric',
      };

      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!res.ok) throw new Error('Failed to update profile');

      const updatedUser = await res.json();

      setUser(prev => ({
        ...prev,
        ...updatedUser,              // keep user data in sync
        unit: payload.unit,          // ← THIS is the critical line
        height: payload.height,      // keep height consistent too
      }));
      onSave();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Error', 'Please log in');
        navigation.navigate('Login');
        return;
      }

      const res = await fetch(`${API_BASE_URL}/profile/delete_image/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === 'TOKEN_EXPIRED') {
          await AsyncStorage.removeItem('token');
          Alert.alert('Session expired', 'Please log in again.');
          navigation.navigate('Login');
          return;
        }
      }

      if (!res.ok) throw new Error('Failed to delete image');

      setImages((prevImages) => prevImages.filter((img) => img.id !== imageId));
      Alert.alert('Success', 'Image deleted successfully');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to delete image');
    }
  };

  const handleCancel = () => {
    setImageError('');
    setFieldErrors({
      first_name: '',
      last_name: '',
      birthdate: '',
      height: '',
    });
    setEditing(false);
  };

  const lightboxUris = useMemo(
    () =>
      (images || [])
        .map((img) => (img?.image_url ? getImageUrl(img.image_url, API_BASE_URL) : null))
        .filter(Boolean),
    [images]
  );

  const goNextLightbox = useCallback(() => {
    setLightboxIndex((i) => {
      if (i == null) return i;
      const last = lightboxUris.length - 1;
      if (last < 0) return null;
      return i < last ? i + 1 : i;
    });
  }, [lightboxUris.length]);

  const goPrevLightbox = useCallback(() => {
    setLightboxIndex((i) => {
      if (i == null) return i;
      return i > 0 ? i - 1 : i;
    });
  }, []);

  const lightboxPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .onEnd((e) => {
          'worklet';
          const { translationX, translationY, velocityX, velocityY } = e;
          const T = 48;
          const vT = 380;
          const absX = Math.abs(translationX);
          const absY = Math.abs(translationY);
          if (absX < 10 && absY < 10) return;
          if (absX >= absY) {
            if (translationX > T || velocityX > vT) {
              runOnJS(goPrevLightbox)();
            } else if (translationX < -T || velocityX < -vT) {
              runOnJS(goNextLightbox)();
            }
          } else {
            if (translationY > T || velocityY > vT) {
              runOnJS(goPrevLightbox)();
            } else if (translationY < -T || velocityY < -vT) {
              runOnJS(goNextLightbox)();
            }
          }
        }),
    [goNextLightbox, goPrevLightbox]
  );

  useEffect(() => {
    setLightboxIndex((i) => {
      if (i == null) return i;
      if (lightboxUris.length === 0) return null;
      return i >= lightboxUris.length ? lightboxUris.length - 1 : i;
    });
  }, [lightboxUris]);

  if (!user) return null;

  const profileImageUri = images?.[0]?.image_url
    ? getImageUrl(images[0].image_url, API_BASE_URL)
    : null;
  const ageText = user.birthdate ? ` ${calculateAge(user.birthdate)}` : '';
  const locationText = [user.city, user.state].filter(Boolean).join(', ');
  const shouldShowLocation = !editing && user.show_location && locationText;
  const initialLetter = (user.first_name || '?').charAt(0).toUpperCase();
  const displayGender = (user.gender || formData.gender || '').trim();
  const displayHeight = (
    convertHeightForViewer(user.height, user.unit, viewerUnit) ||
    user.height ||
    formatHeight(formData, heightUnit) ||
    ''
  ).trim();
  const accentColor = getRoleAccentColor(user?.role || 'matchmaker');
  const openImageLightbox =
    enableImageLightbox && !editing
      ? (uri) => {
          if (lightboxUris.length === 0) return;
          const i = lightboxUris.findIndex((u) => u === uri);
          setLightboxIndex(i >= 0 ? i : 0);
        }
      : undefined;

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollOffsetYRef.current = event.nativeEvent.contentOffset.y;
        }}
        style={[styles.container, framed && styles.framed, formData.profileStyle === 'pixelCloud' && styles.pixelCloud, formData.profileStyle === 'pixelFlower' && styles.pixelFlower, formData.profileStyle === 'minimal' && styles.minimal, formData.profileStyle === 'bold' && styles.bold, formData.profileStyle === 'classic' && styles.classic]}>
          {formData.profileStyle === 'pixelCloud' && <PixelClouds />}
          {formData.profileStyle === 'pixelFlower' && <PixelFlowers />}
          {formData.profileStyle === 'pixelCactus' && <PixelCactus />}
          {user.role === 'user' && (
        <View style={styles.profileHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarCircle}>
              {profileImageUri ? (
                openImageLightbox ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.avatarImageTouchable}
                    onPress={() => openImageLightbox(profileImageUri)}
                    accessibilityRole="button"
                    accessibilityLabel="Enlarge profile photo"
                  >
                    <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
                  </TouchableOpacity>
                ) : (
                  <Image source={{ uri: profileImageUri }} style={styles.avatarImage} />
                )
              ) : (
                <Text style={styles.avatarFallback}>{initialLetter}</Text>
              )}
            </View>
            {!editing && (
              <View style={styles.nameSection}>
                <Text style={[styles.name, { fontFamily: formData.fontFamily }]}>
                  {user.first_name || ''}
                  {ageText ? <Text style={styles.age}>{ageText}</Text> : null}
                </Text>
                {shouldShowLocation ? (
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={14} color="#d63384" />
                    <Text style={styles.locationText}>{locationText}</Text>
                  </View>
                ) : null}
                <View style={styles.metaPillsRow}>
                  {displayGender ? (
                    <View style={styles.metaPill}>
                      <Ionicons name="male-female-outline" size={14} color="#374151" />
                      <Text style={styles.metaPillText}>{displayGender}</Text>
                    </View>
                  ) : null}
                  {displayHeight ? (
                    <View style={styles.metaPill}>
                      <Ionicons name="resize-outline" size={14} color="#374151" />
                      <Text style={styles.metaPillText}>{displayHeight}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </View>
          {!framed && !editing && (
            <View style={styles.profileActions}>
              <TouchableOpacity style={styles.editIconButton} onPress={() => setEditing(true)}>
                <Ionicons name="create-outline" size={24} color={accentColor} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {user.role === 'user' && (
          <ProfileInfoCard
            user={user}
            formData={formData}
            editing={editing}
            heightUnit={heightUnit}
            viewerUnit={viewerUnit}
            onInputChange={handleInputChange}
            onUnitToggle={handleUnitToggle}
            onSubmit={handleFormSubmit}
            onCancel={handleCancel}
            calculateAge={calculateAge}
            images={images}
            onDeleteImage={handleDeleteImage}
            onPlaceholderClick={handlePlaceholderClick}
            onImagePress={openImageLightbox}
            imageError={imageError}
            fieldErrors={fieldErrors}
            profileStyle={formData.profileStyle}
            scrollToBottom={(target, calendarBottomYInWindow) => {
                const ref = parentScrollRef || scrollViewRef;
                const activeScrollOffset =
                  (parentScrollRef
                    ? parentScrollOffsetYRef?.current
                    : scrollOffsetYRef.current) || 0;
                if (target === 'calendar-wrapper-end' && calendarBottomYInWindow) {
                  ref.current?.measureInWindow((_, scrollY, __, scrollH) => {
                    const viewportBottom = scrollY + scrollH;
                    const overflow = calendarBottomYInWindow - viewportBottom;
                    if (overflow > 0) {
                      ref.current?.scrollTo({
                        y: activeScrollOffset + overflow + 24,
                        animated: true,
                      });
                    }
                  });
                  return;
                }
                ref.current?.scrollTo({ y: 300, animated: true });
            }}
          />
      )}

      </ScrollView>
      {editing && user.role === 'user' && (
        <View style={styles.actionsOutsideCard}>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accentColor }]} onPress={handleFormSubmit}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: accentColor }]} onPress={handleCancel}>
              <Text style={[styles.cancelBtnText, { color: accentColor }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {enableImageLightbox ? (
        <Modal
          visible={lightboxIndex != null && lightboxUris.length > 0}
          transparent
          animationType="fade"
          onRequestClose={() => setLightboxIndex(null)}
        >
          <GestureHandlerRootView style={styles.imageLightboxRoot}>
            <Pressable
              style={[StyleSheet.absoluteFillObject, styles.imageLightboxBackdrop]}
              onPress={() => setLightboxIndex(null)}
              accessibilityLabel="Dismiss image preview"
            />
            <View
              pointerEvents="box-none"
              style={[StyleSheet.absoluteFillObject, styles.imageLightboxImageWrap]}
            >
              {lightboxIndex != null && lightboxUris[lightboxIndex] ? (
                <>
                  {lightboxUris.length > 1 ? (
                    <Text style={styles.imageLightboxCounter} pointerEvents="none">
                      {lightboxIndex + 1} / {lightboxUris.length}
                    </Text>
                  ) : null}
                  <GestureDetector gesture={lightboxPanGesture}>
                    <View
                      style={styles.imageLightboxHitArea}
                      accessible
                      accessibilityRole="image"
                      accessibilityLabel={`Photo ${lightboxIndex + 1} of ${lightboxUris.length}. Swipe left or up for the next image, right or down for the previous image.`}
                    >
                      <Image
                        key={lightboxUris[lightboxIndex]}
                        source={{ uri: lightboxUris[lightboxIndex] }}
                        style={{
                          width: LIGHTBOX_WIN_W * 0.92,
                          height: LIGHTBOX_WIN_H * 0.78,
                        }}
                        resizeMode="contain"
                      />
                    </View>
                  </GestureDetector>
                </>
              ) : null}
            </View>
            <TouchableOpacity
              style={[
                styles.imageLightboxClose,
                { top: insets.top + 10, right: Math.max(insets.right, 16) },
              ]}
              onPress={() => setLightboxIndex(null)}
              accessibilityRole="button"
              accessibilityLabel="Close image preview"
            >
              <View style={styles.imageLightboxCloseInner}>
                <Ionicons name="close" size={28} color="#ffffff" />
              </View>
            </TouchableOpacity>
          </GestureHandlerRootView>
        </Modal>
      ) : null}
    </>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  card: {
    padding: 16,
    backgroundColor: 'transparent',
  },
  framed: {
    borderWidth: 2,
    borderColor: '#ebe7fb',
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d3c8bb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f6f0e8',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarImageTouchable: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    fontSize: 34,
    color: '#ffffff',
    fontWeight: '600',
  },
  nameSection: {
    flex: 1,
  },
  name: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 40,
  },
  age: {
    fontSize: 28,
    fontWeight: '500',
    color: '#111827',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  locationText: {
    fontSize: 16,
    color: '#4b5563',
  },
  metaPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
  },
  metaPillText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editIconButton: {
    transform: [{ translateX: -20 }],
  },
  actionsOutsideCard: {
    marginTop: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#6c5ce7',
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6c5ce7',
    backgroundColor: 'transparent',
  },
  cancelBtnText: {
    color: '#6c5ce7',
    fontSize: 16,
    fontWeight: '600',
  },
  /* Theme styles */
  pixelCloud: {
    backgroundColor: '#87CEEB',
  },
  pixelFlower: {
    backgroundColor: '#F2F6FF',
  },
  pixelCactus: {
    backgroundColor: '#FFEBF3',
  },
  minimal: {
    backgroundColor: '#FFFFFF',
  },
  bold: {
    backgroundColor: '#F5F3FF',
  },
  constitution: {
    backgroundColor: '#FDF5D9',
    // subtle frame to mimic papyrus
    borderWidth: 1,
    borderColor: '#eed8a8',
  },
  classic: {
    backgroundColor: '#FFFFFF',
  },
  imageLightboxRoot: {
    flex: 1,
  },
  imageLightboxBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  imageLightboxImageWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLightboxCounter: {
    position: 'absolute',
    top: '10%',
    zIndex: 2,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  imageLightboxHitArea: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageLightboxClose: {
    position: 'absolute',
    zIndex: 10,
  },
  imageLightboxCloseInner: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 20,
    padding: 6,
  },
});
