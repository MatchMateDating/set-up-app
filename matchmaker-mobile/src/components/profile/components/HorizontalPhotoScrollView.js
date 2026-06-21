import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ScrollView } from 'react-native-gesture-handler';

/**
 * Horizontal photo pager for nested vertical scroll views.
 * Uses native paging (no custom snap) to avoid scroll feedback loops.
 */
const HorizontalPhotoScrollView = forwardRef(function HorizontalPhotoScrollView(
  {
    children,
    itemWidth,
    onIndexChange,
    resetKey,
    contentContainerStyle,
    style,
    onMomentumScrollEnd: onMomentumScrollEndProp,
    ...rest
  },
  ref
) {
  const scrollRef = useRef(null);

  useImperativeHandle(ref, () => scrollRef.current);

  useEffect(() => {
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [resetKey]);

  const handleMomentumScrollEnd = (event) => {
    if (itemWidth > 0 && onIndexChange) {
      const index = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
      onIndexChange(index);
    }
    onMomentumScrollEndProp?.(event);
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled={itemWidth > 0}
      showsHorizontalScrollIndicator={false}
      directionalLockEnabled
      nestedScrollEnabled
      decelerationRate="fast"
      scrollEventThrottle={16}
      contentContainerStyle={contentContainerStyle}
      style={style}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      {...rest}
    >
      {children}
    </ScrollView>
  );
});

export default HorizontalPhotoScrollView;
