export const Colors = {
  light: {
    text: '#000',
    textSecondary: '#666',
    background: '#fff',
    backgroundElement: '#f5f5f5',
    backgroundSelected: '#e0e0e0',
    tint: '#2f95dc',
    tabIconDefault: '#ccc',
    tabIconSelected: '#2f95dc',
  },
  dark: {
    text: '#fff',
    textSecondary: '#ccc',
    background: '#000',
    backgroundElement: '#1a1a1a',
    backgroundSelected: '#333',
    tint: '#fff',
    tabIconDefault: '#ccc',
    tabIconSelected: '#fff',
  },
};

export type ThemeColor = 'text' | 'textSecondary' | 'background' | 'backgroundElement' | 'backgroundSelected' | 'tint' | 'tabIconDefault' | 'tabIconSelected';

export const Fonts = {
  regular: 'System',
  bold: 'System-Bold',
  mono: 'System',
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const MaxContentWidth = 1200;
