// react-native-web does not implement Alert.alert, so on the web every dialog (forfeit
// confirmations, error messages) would silently do nothing. This gives it the browser's own
// alert / confirm. It only runs on the web; phones are not affected.
import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    // Two or more buttons: OK runs the action (the first button that is not "cancel"), Cancel the cancel button.
    const cancel = buttons.find((b) => b.style === 'cancel');
    const action = buttons.find((b) => b !== cancel) ?? buttons[buttons.length - 1];
    if (window.confirm(text)) action.onPress?.();
    else cancel?.onPress?.();
  };
}
