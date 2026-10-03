import { Alert, Platform } from 'react-native';

/**
 * Asks "are you sure?" before something that deletes data, then runs
 * `onConfirm`. `Alert.alert` does nothing on web, so the browser's own dialog
 * is used there.
 */
export function confirmRemove(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: onConfirm },
  ]);
}
