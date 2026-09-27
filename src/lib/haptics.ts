/**
 * VELORA AI Haptics System
 * Safe browser vibration API wrapper with feature detection and zero side-effects.
 */

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function triggerHaptic(pattern: HapticPattern = 'light') {
  if (typeof window === 'undefined' || !('navigator' in window)) return;
  if (!navigator.vibrate) return;

  try {
    switch (pattern) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate(45);
        break;
      case 'success':
        navigator.vibrate([15, 40, 25]);
        break;
      case 'warning':
        navigator.vibrate([30, 60, 30]);
        break;
      case 'error':
        navigator.vibrate([50, 40, 50, 40, 50]);
        break;
    }
  } catch {
    // Vibration ignored or permission denied
  }
}
