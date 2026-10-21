import { createContext, useContext } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type StyleProp, type TextInputProps, type TextProps, type TextStyle } from 'react-native';
import { FONT } from './theme';

const isBold = (w: TextStyle['fontWeight']) => w === 'bold' || (w !== undefined && w !== 'normal' && Number(w) >= 600);

/** Size used when a text does not set one, so body text looks the same on every platform. */
export const BODY_SIZE = 15;

/**
 * Line height from font size. Small text needs the most room; large headings the least. React Native only takes
 * absolute line heights, so this works out the pixel value for each size.
 */
export const lineHeightFor = (size: number) => Math.round(size * (size <= 16 ? 1.55 : size <= 22 ? 1.4 : 1.25));

/** True inside another Text, where size and line height are inherited and must not be reset. */
const InsideText = createContext(false);

/**
 * Resolves a style to the right Libron file. A heavy `fontWeight` selects Libron Bold and is then reset, so the
 * platform does not fake a second layer of bold on top of it.
 */
function fontStyle(style: StyleProp<TextStyle>): { flat: TextStyle; family: StyleProp<TextStyle>; reset: TextStyle | null } {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return { flat, family: null, reset: null };
  const bold = isBold(flat.fontWeight);
  return { flat, family: { fontFamily: bold ? FONT.bold : FONT.regular }, reset: bold ? { fontWeight: 'normal' } : null };
}

/** Drop-in replacement for React Native's Text: Libron, a consistent body size and comfortable line spacing. */
export function Text({ style, children, ...props }: TextProps) {
  const nested = useContext(InsideText);
  const { flat, family, reset } = fontStyle(style);
  const size = flat.fontSize ?? BODY_SIZE;
  const spacing: TextStyle | null = nested ? null : { fontSize: size, lineHeight: flat.lineHeight ?? lineHeightFor(size) };
  return (
    <RNText {...props} style={[family, spacing, style, reset]}>
      <InsideText.Provider value>{children}</InsideText.Provider>
    </RNText>
  );
}

/** Same typeface for text fields. No line height is forced: it misaligns the text and cursor on some platforms. */
export function TextInput({ style, ...props }: TextInputProps) {
  const { family, reset } = fontStyle(style);
  return <RNTextInput {...props} style={[family, style, reset]} />;
}
