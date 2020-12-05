import * as React from 'react';
import {
  StyleSheet,
  ViewStyle,
  I18nManager,
  Platform,
  Keyboard,
  StatusBar,
  StyleProp,
  View,
  InteractionManager,
  TouchableWithoutFeedback,
} from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State as GestureState,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Overlay from './Overlay';

const SWIPE_DISTANCE_THRESHOLD_DEFAULT = 60;
const SWIPE_DISTANCE_MINIMUM = 5;

const DEFAULT_DRAWER_WIDTH = '80%';

type Renderer = () => React.ReactNode;

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  gestureEnabled?: boolean;
  swipeEnabled?: boolean;
  drawerPosition?: 'left' | 'right';
  drawerType?: 'front' | 'back' | 'slide' | 'permanent';
  keyboardDismissMode?: 'none' | 'on-drag';
  swipeEdgeWidth?: number;
  swipeDistanceThreshold?: number;
  swipeVelocityThreshold?: number;
  hideStatusBarOnOpen?: boolean;
  statusBarAnimation?: 'slide' | 'none' | 'fade';
  overlayStyle?: StyleProp<ViewStyle>;
  drawerStyle?: StyleProp<ViewStyle>;
  sceneContainerStyle?: StyleProp<ViewStyle>;
  renderDrawerContent: Renderer;
  renderSceneContent: Renderer;
  gestureHandlerProps?: React.ComponentProps<typeof PanGestureHandler>;
  dimensions: { width: number; height: number };
};

export default function Drawer({
  drawerPosition = I18nManager.isRTL ? 'left' : 'right',
  drawerStyle,
  drawerType = 'front',
  gestureEnabled = true,
  gestureHandlerProps,
  hideStatusBarOnOpen = false,
  keyboardDismissMode = 'on-drag',
  open,
  setOpen,
  overlayStyle,
  renderDrawerContent,
  renderSceneContent,
  sceneContainerStyle,
  statusBarAnimation = 'slide',
  swipeEdgeWidth = 32,
  swipeEnabled = Platform.OS !== 'web' &&
    Platform.OS !== 'windows' &&
    Platform.OS !== 'macos',
  swipeVelocityThreshold = 500,
  swipeDistanceThreshold = SWIPE_DISTANCE_THRESHOLD_DEFAULT,
  dimensions,
}: Props) {
  const getDrawerWidth = (): number => {
    const { width = DEFAULT_DRAWER_WIDTH } =
      StyleSheet.flatten(drawerStyle) || {};

    if (typeof width === 'string' && width.endsWith('%')) {
      // Try to calculate width if a percentage is given
      const percentage = Number(width.replace(/%$/, ''));

      if (Number.isFinite(percentage)) {
        return dimensions.width * (percentage / 100);
      }
    }

    return typeof width === 'number' ? width : 0;
  };

  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document?.body?.addEventListener?.('keyup', handleEscape);

    return () => document?.body?.removeEventListener?.('keyup', handleEscape);
  }, [setOpen]);

  const hideStatusBar = React.useCallback(
    (hide: boolean) => {
      if (hideStatusBarOnOpen) {
        StatusBar.setHidden(hide, statusBarAnimation);
      }
    },
    [hideStatusBarOnOpen, statusBarAnimation]
  );

  React.useEffect(() => {
    hideStatusBar(open);

    return () => hideStatusBar(false);
  }, [open, hideStatusBarOnOpen, statusBarAnimation, hideStatusBar]);

  const interactionHandleRef = React.useRef<number | null>(null);

  const startInteraction = () => {
    interactionHandleRef.current = InteractionManager.createInteractionHandle();
  };

  const endInteraction = () => {
    if (interactionHandleRef.current != null) {
      InteractionManager.clearInteractionHandle(interactionHandleRef.current);
      interactionHandleRef.current = null;
    }
  };

  const hideKeyboard = () => {
    if (keyboardDismissMode === 'on-drag') {
      Keyboard.dismiss();
    }
  };

  const onGestureStart = () => {
    startInteraction();
    hideKeyboard();
    hideStatusBar(true);
  };

  const onGestureEnd = () => {
    endInteraction();
  };

  const isOpen = drawerType === 'permanent' ? true : open;
  const isRight = drawerPosition === 'right';

  // FIXME: Currently hitSlop is broken when on Android when drawer is on right
  // https://github.com/kmagiera/react-native-gesture-handler/issues/569
  const hitSlop = isRight
    ? // Extend hitSlop to the side of the screen when drawer is closed
      // This lets the user drag the drawer from the side of the screen
      { right: 0, width: isOpen ? undefined : swipeEdgeWidth }
    : { left: 0, width: isOpen ? undefined : swipeEdgeWidth };

  const drawerWidth = getDrawerWidth();

  const touchX = useSharedValue(0);
  const translationX = useSharedValue(0);
  const gestureState = useSharedValue<GestureState>(GestureState.UNDETERMINED);

  const getDrawerTranslationX = React.useCallback(
    (open: boolean) => {
      'worklet';

      return drawerPosition === 'left'
        ? open
          ? 0
          : -drawerWidth
        : open
        ? dimensions.width - drawerWidth
        : dimensions.width;
    },
    [dimensions.width, drawerPosition, drawerWidth]
  );

  const toggleDrawer = React.useCallback(
    (open: boolean, velocity?: number) => {
      'worklet';

      const translateX = getDrawerTranslationX(open);

      touchX.value = drawerPosition === 'left' ? 0 : dimensions.width;
      translationX.value = withSpring(translateX, {
        velocity,
        stiffness: 1000,
        damping: 500,
        mass: 3,
        overshootClamping: true,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
      });
    },
    [
      dimensions.width,
      drawerPosition,
      getDrawerTranslationX,
      touchX,
      translationX,
    ]
  );

  React.useEffect(() => toggleDrawer(open), [open, toggleDrawer]);

  const onGestureEvent = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    { startX: number }
  >({
    onStart: (event, ctx) => {
      ctx.startX = translationX.value;
      gestureState.value = event.state;

      runOnJS(onGestureStart)();
    },
    onActive: (event, ctx) => {
      touchX.value = event.x;
      translationX.value = ctx.startX + event.translationX;
      gestureState.value = event.state;
    },
    onEnd: (event) => {
      gestureState.value = event.state;

      const nextOpen =
        (Math.abs(event.translationX) > SWIPE_DISTANCE_MINIMUM &&
          Math.abs(event.translationX) > swipeVelocityThreshold) ||
        Math.abs(event.translationX) > swipeDistanceThreshold
          ? drawerPosition === 'left'
            ? // If swiped to right, open the drawer, otherwise close it
              (event.velocityX === 0 ? event.translationX : event.velocityX) > 0
            : // If swiped to left, open the drawer, otherwise close it
              (event.velocityX === 0 ? event.translationX : event.velocityX) < 0
          : open;

      toggleDrawer(nextOpen, event.velocityX);
      runOnJS(onGestureEnd)();
    },
  });

  const translateX = useDerivedValue(() => {
    const minmax = (value: number, start: number, end: number) =>
      Math.min(Math.max(value, start), end);

    // Comment stolen from react-native-gesture-handler/DrawerLayout
    //
    // While closing the drawer when user starts gesture outside of its area (in greyed
    // out part of the window), we want the drawer to follow only once finger reaches the
    // edge of the drawer.
    // E.g. on the diagram below drawer is illustrate by X signs and the greyed out area by
    // dots. The touch gesture starts at '*' and moves left, touch path is indicated by
    // an arrow pointing left
    // 1) +---------------+ 2) +---------------+ 3) +---------------+ 4) +---------------+
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    |XXXXXXXX|......|    |XXXXXXXX|.<-*..|    |XXXXXXXX|<--*..|    |XXXXX|<-----*..|
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXXXXX|......|    |XXXXX|.........|
    //    +---------------+    +---------------+    +---------------+    +---------------+
    //
    // For the above to work properly we define animated value that will keep start position
    // of the gesture. Then we use that value to calculate how much we need to subtract from
    // the translationX. If the gesture started on the greyed out area we take the distance from the
    // edge of the drawer to the start position. Otherwise we don't subtract at all and the
    // drawer be pulled back as soon as you start the pan.
    //
    // This is used only when drawerType is "front"
    const touchDistance =
      drawerType === 'front' && gestureState.value === GestureState.ACTIVE
        ? drawerPosition === 'left'
          ? Math.min(translationX.value - touchX.value + drawerWidth, 0)
          : Math.min(
              translationX.value - touchX.value,
              dimensions.width - drawerWidth
            )
        : 0;

    const translateX =
      drawerPosition === 'left'
        ? minmax(translationX.value - touchDistance, -drawerWidth, 0)
        : minmax(
            translationX.value - touchDistance,
            dimensions.width - drawerWidth,
            dimensions.width
          );

    return translateX;
  });

  useAnimatedReaction(
    () => {
      if (translateX.value === getDrawerTranslationX(true)) {
        return true;
      } else if (translateX.value === getDrawerTranslationX(false)) {
        return false;
      }

      return null;
    },
    (open) => {
      if (open !== null) {
        runOnJS(setOpen)(open);
      }
    }
  );

  const drawerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: drawerType === 'back' ? 0 : translateX.value }],
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX:
            drawerType === 'front' || drawerType === 'permanent'
              ? 0
              : translateX.value,
        },
      ],
    };
  });

  const progress = useDerivedValue(
    // TODO: calculate progress in terms of 0-1
    () => (drawerWidth - Math.abs(translateX.value)) / drawerWidth
  );

  return (
    <PanGestureHandler
      activeOffsetX={[-SWIPE_DISTANCE_MINIMUM, SWIPE_DISTANCE_MINIMUM]}
      failOffsetY={[-SWIPE_DISTANCE_MINIMUM, SWIPE_DISTANCE_MINIMUM]}
      hitSlop={hitSlop}
      enabled={drawerType !== 'permanent' && gestureEnabled && swipeEnabled}
      onGestureEvent={onGestureEvent}
      {...gestureHandlerProps}
    >
      <Animated.View
        style={[
          styles.main,
          {
            flexDirection:
              drawerType === 'permanent' && !isRight ? 'row-reverse' : 'row',
          },
        ]}
      >
        <Animated.View
          style={[
            styles.content,
            contentAnimatedStyle,
            sceneContainerStyle as any,
          ]}
        >
          <View
            accessibilityElementsHidden={isOpen && drawerType !== 'permanent'}
            importantForAccessibility={
              isOpen && drawerType !== 'permanent'
                ? 'no-hide-descendants'
                : 'auto'
            }
            style={styles.content}
          >
            {renderSceneContent()}
          </View>

          <TouchableWithoutFeedback
            onPress={gestureEnabled ? () => toggleDrawer(false) : undefined}
          >
            <Overlay progress={progress} style={overlayStyle} />
          </TouchableWithoutFeedback>
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal={isOpen && drawerType !== 'permanent'}
          removeClippedSubviews={Platform.OS !== 'ios'}
          style={[
            styles.container,
            styles.nonPermanent,
            { zIndex: drawerType === 'back' ? -1 : 0 },
            drawerAnimatedStyle,
            drawerStyle as any,
          ]}
        >
          {renderDrawerContent()}
        </Animated.View>
      </Animated.View>
    </PanGestureHandler>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'tomato',
    maxWidth: '100%',
  },
  nonPermanent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: DEFAULT_DRAWER_WIDTH,
  },
  content: {
    flex: 1,
  },
  main: {
    flex: 1,
    ...Platform.select({
      // FIXME: We need to hide `overflowX` on Web so the translated content doesn't show offscreen.
      // But adding `overflowX: 'hidden'` prevents content from collapsing the URL bar.
      web: null,
      default: { overflow: 'hidden' },
    }),
  },
});
