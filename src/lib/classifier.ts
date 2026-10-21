/**
 * On-device food recognition hook.
 *
 * `classifyFood` takes a photo and returns candidate dishes (ids from `DISHES`) ranked by confidence.
 * The photo screen shows these as one-tap suggestions; the user always confirms the dish and portion,
 * because calories cannot be read reliably from a picture alone.
 *
 * No trained model for Indian vegetarian dishes ships with the app, so this returns no suggestions
 * and the photo screen falls back to searching the dish list beside the picture.
 *
 * To plug a model in (needs a development build, not Expo Go):
 *   1. npm install react-native-fast-tflite and add its Expo config plugin.
 *   2. Put the .tflite file and its labels in assets/model/.
 *   3. Run it in `classifyFood`, map each label to a DISHES id, and set `classifierAvailable` to true.
 */
export interface Suggestion {
  dishId: string;
  confidence: number;
}

export const classifierAvailable = false;

export async function classifyFood(_photoUri: string): Promise<Suggestion[]> {
  return [];
}
