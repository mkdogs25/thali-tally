import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { INGREDIENTS } from '../../lib/foods';
import { colors } from '../theme';
import { Button, Muted } from '../ui';

export function IngredientPicker({ onPick, onCancel }: { onPick: (id: string) => void; onCancel: () => void }) {
  const [q, setQ] = useState('');
  const matches = INGREDIENTS.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);
  return (
    <View style={{ marginBottom: 12 }}>
      <TextInput
        autoFocus
        value={q}
        onChangeText={setQ}
        placeholder="Search ingredient…"
        placeholderTextColor={colors.muted}
        style={{ borderWidth: 1, borderColor: colors.saffron, borderRadius: 10, backgroundColor: '#fff', padding: 10, fontSize: 16, color: colors.text }}
      />
      {matches.map((i) => (
        <Pressable key={i.id} onPress={() => onPick(i.id)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Text style={{ color: colors.text }}>{i.name}</Text>
        </Pressable>
      ))}
      {matches.length === 0 ? <Muted style={{ marginTop: 8 }}>Not in the list. Use Quick add to enter the numbers yourself.</Muted> : null}
      <View style={{ height: 8 }} />
      <Button title="Cancel" kind="secondary" onPress={onCancel} />
    </View>
  );
}
