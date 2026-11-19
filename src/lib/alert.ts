import { Alert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Cross-platform replacement for `Alert.alert`.
 *
 * `react-native-web` ships a no-op Alert implementation, so every error,
 * confirmation, and success dialog would silently disappear on the web build.
 * This wrapper keeps the native API and maps it to window.alert/confirm.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const web = globalThis as typeof globalThis & {
    alert: (text: string) => void;
    confirm: (text: string) => boolean;
  };
  const body = [title, message].filter(Boolean).join('\n\n');

  if (!buttons || buttons.length === 0) {
    web.alert(body);
    return;
  }

  if (buttons.length === 1) {
    web.alert(body);
    buttons[0].onPress?.();
    return;
  }

  const actionable = buttons.filter((button) => button.style !== 'cancel');
  const cancel = buttons.find((button) => button.style === 'cancel');

  if (actionable.length === 1) {
    if (web.confirm(body)) actionable[0].onPress?.();
    else cancel?.onPress?.();
    return;
  }

  // Multi-action sheets (for example the photo source picker) are presented
  // one action at a time so no option becomes unreachable on the web.
  for (const button of actionable) {
    if (web.confirm(`${body}\n\n${button.text || 'Continue'}?`)) {
      button.onPress?.();
      return;
    }
  }
}
