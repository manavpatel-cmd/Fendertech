import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

function safe(fn: () => void) {
  if (Platform.OS === "web") return;
  try {
    fn();
  } catch {
    /* no-op */
  }
}

export function hapticLight() {
  safe(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticMedium() {
  safe(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}
