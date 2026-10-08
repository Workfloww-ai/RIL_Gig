import { useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';

export function useTheme() {
  const colorScheme = useColorScheme();
  const schemeName = (colorScheme === 'dark' || colorScheme === 'light') ? colorScheme : 'light';
  const themeColors = Colors[schemeName];
  return {
    theme: themeColors,
    isDark: schemeName === 'dark',
  };
}
