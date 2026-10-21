import { StyleSheet, Text as RNText, TextInput as RNTextInput, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from 'react-native';
import { FONT } from './theme';

const isBold = (w: TextStyle['fontWeight']) => w === 'bold' || (w !== undefined && w !== 'normal' && Number(w) >= 600);

/**
 * Resolves a style to the right Libron file. A heavy `fontWeight` selects Libron Bold and is then reset, so the
 * platform does not fake a second layer of bold on top of it.
 */
function withFont(style: StyleProp<TextStyle>): StyleProp<TextStyle> {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return style;
  const bold = isBold(flat.fontWeight);
  return [{ fontFamily: bold ? FONT.bold : FONT.regular }, style, bold ? { fontWeight: 'normal' } : null];
}

/** Drop-in replacements for React Native's Text and TextInput that default to the app's typeface. */
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={withFont(style)} />;
}

export function TextInput({ style, ...props }: TextInputProps) {
  return <RNTextInput {...props} style={withFont(style)} />;
}
