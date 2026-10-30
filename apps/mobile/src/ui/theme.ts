import { useColorScheme } from 'react-native';

const light = {
  bg: '#ffffff',
  card: '#f3f5f8',
  text: '#0f172a',
  muted: '#475569',
  border: '#d6dbe3',
  primary: '#0b5fb0',
  primaryText: '#ffffff',
  danger: '#b42318',
  climb: '#15803d',
  sink: '#b42318',
};

const dark: typeof light = {
  bg: '#0b1220',
  card: '#152033',
  text: '#f1f5f9',
  muted: '#a3b1c6',
  border: '#2b3a52',
  primary: '#4ea3f5',
  primaryText: '#0b1220',
  danger: '#f97066',
  climb: '#4ade80',
  sink: '#f97066',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
