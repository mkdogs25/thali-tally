import { Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';
import { SERIF } from './theme';

/** Drop-in replacements for React Native's Text and TextInput that default to the app's serif. */
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: SERIF }, style]} />;
}

export function TextInput({ style, ...props }: TextInputProps) {
  return <RNTextInput {...props} style={[{ fontFamily: SERIF }, style]} />;
}
