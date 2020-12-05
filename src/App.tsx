import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Button,
  useWindowDimensions,
} from 'react-native';
import Drawer from './Drawer';

export default function App() {
  const [open, setOpen] = React.useState(true);
  const [left, setLeft] = React.useState(true);
  const dimensions = useWindowDimensions();

  return (
    <Drawer
      open={open}
      setOpen={setOpen}
      drawerPosition={left ? 'left' : 'right'}
      dimensions={dimensions}
      renderDrawerContent={() => (
        <View style={styles.container}>
          <Text>Hello world</Text>
        </View>
      )}
      renderSceneContent={() => (
        <View style={styles.container}>
          <Button
            title={open ? 'Close drawer' : 'Open drawer'}
            onPress={() => setOpen((isOpen) => !isOpen)}
          />
          <Button
            title={left ? 'Move to right' : 'Move to left'}
            onPress={() => setLeft((isLeft) => !isLeft)}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
