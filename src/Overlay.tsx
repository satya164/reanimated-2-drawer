import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

const PROGRESS_EPSILON = 0.05;

type Props = React.ComponentProps<typeof Animated.View> & {
  progress: Animated.SharedValue<number>;
};

const Overlay = React.forwardRef(function Overlay(
  { progress, style, ...props }: Props,
  ref: React.Ref<Animated.View>
) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      // We don't want the user to be able to press through the overlay when drawer is open
      // One approach is to adjust the pointerEvents based on the progress
      // But we can also send the overlay behind the screen, which works, and is much less code
      zIndex: progress.value > PROGRESS_EPSILON ? 0 : -1,
    };
  });

  return (
    <Animated.View
      {...props}
      ref={ref}
      style={[styles.overlay, overlayStyle, animatedStyle, style]}
    />
  );
});

const overlayStyle = Platform.select<Record<string, string>>({
  web: {
    // Disable touch highlight on mobile Safari.
    // WebkitTapHighlightColor must be used outside of StyleSheet.create because react-native-web will omit the property.
    WebkitTapHighlightColor: 'transparent',
  },
  default: {},
});

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});

export default Overlay;
