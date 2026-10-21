import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { classifierAvailable, classifyFood, Suggestion } from '../../lib/classifier';
import { DISH_BY_ID } from '../../lib/foods';
import { colors } from '../theme';
import { Button, Card, Chip, H2, Muted, Wrap } from '../ui';
import { SearchFood } from './SearchFood';
import type { LogFn } from './types';

/**
 * Take or choose a photo of the meal, then confirm the dish and portion.
 * Photo → calories is an estimate at best, so the person always confirms what was eaten.
 */
export function PhotoLog({ onLog }: { onLog: LogFn }) {
  const [uri, setUri] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [query, setQuery] = useState(0);

  const handle = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const photo = result.assets[0].uri;
    setUri(photo);
    setSuggestions(await classifyFood(photo));
    setQuery((n) => n + 1);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera permission needed', 'Allow camera access in your phone settings to photograph meals.');
    await handle(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 }));
  };

  const pickPhoto = async () => handle(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 }));

  return (
    <View>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: 220, borderRadius: 16, marginBottom: 12, backgroundColor: colors.track }} /> : null}
      <Button title={uri ? 'Retake photo' : '📷 Take a photo of your meal'} onPress={takePhoto} />
      <Button title="Choose from gallery" kind="secondary" onPress={pickPhoto} />

      {!classifierAvailable ? (
        <Card style={{ backgroundColor: '#FDF0DE' }}>
          <Muted>
            Automatic dish recognition is not installed yet, so identify the dish yourself below. The photo is only used to jog your memory
            and stays on your phone.
          </Muted>
        </Card>
      ) : null}

      {suggestions.length > 0 ? (
        <>
          <H2>Looks like…</H2>
          <Wrap>
            {suggestions.map((s) => (
              <Chip key={s.dishId} label={`${DISH_BY_ID[s.dishId]?.name ?? s.dishId} ${Math.round(s.confidence * 100)}%`} onPress={() => {}} />
            ))}
          </Wrap>
        </>
      ) : null}

      {uri ? <SearchFood key={query} source="photo" onLog={onLog} /> : null}
    </View>
  );
}
