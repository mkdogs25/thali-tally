import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BrowseItem, itemsIn, searchItems, tilesFor } from '../lib/browse';
import { BEVERAGE_GROUPS, CATEGORIES, Category } from '../lib/foods';
import { Text, TextInput } from './Text';
import { colors } from './theme';
import { Chip, Muted, n0, n1, Row, Wrap } from './ui';

export const MY_RECIPES: Category = { id: 'my-recipes', label: 'My recipes', hint: 'Saved from the Recipe tab' };

/**
 * Foods grouped under categories (North Indian, South Indian, Beverages…) so there is never one endless list.
 * Typing searches everything; otherwise you pick a category tile, and Beverages splits further into tea and
 * coffee, milk and lassi, and juices and cold drinks.
 */
export function FoodBrowser<T>({
  items,
  onSelect,
  onLongPress,
  placeholder = 'Search dal, paneer, chai, dosa…',
  leading,
}: {
  items: BrowseItem<T>[];
  onSelect: (item: BrowseItem<T>) => void;
  onLongPress?: (item: BrowseItem<T>) => void;
  placeholder?: string;
  /** Shown above the list (for example the amount picker for the chosen food). */
  leading?: React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);

  const tiles = useMemo(() => tilesFor(items, CATEGORIES, [MY_RECIPES]), [items]);
  const searching = query.trim().length > 0;
  const found = useMemo(() => (searching ? searchItems(items, query) : null), [items, query, searching]);
  const shown = useMemo(() => (category ? itemsIn(items, category, group) : []), [items, category, group]);
  const active = tiles.find((t) => t.id === category);

  const row = (item: BrowseItem<T>) => (
    <Pressable
      key={item.key}
      onPress={() => onSelect(item)}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      accessibilityRole="button"
      style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text>
          <Muted>{item.sub}</Muted>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{n0(item.kcal)} kcal</Text>
          <Muted>{n1(item.protein)} g protein</Muted>
        </View>
      </Row>
    </Pressable>
  );

  return (
    <View>
      <View style={{ marginBottom: 12 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          accessibilityLabel="Search foods"
          style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.inputBg, padding: 12, fontSize: 16, color: colors.text }}
        />
      </View>

      {leading}

      {found ? (
        <>
          <Muted style={{ marginBottom: 4 }}>
            {found.total === 0 ? 'No match.' : `${found.total} match${found.total === 1 ? '' : 'es'} across all categories`}
            {found.total > found.results.length ? `, showing the first ${found.results.length}. Type more to narrow it.` : ''}
          </Muted>
          {found.results.map(row)}
        </>
      ) : category && active ? (
        <>
          <Wrap>
            <Chip label="‹ All categories" onPress={() => { setCategory(null); setGroup(null); }} />
          </Wrap>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 20, marginBottom: 2 }}>{active.label}</Text>
          <Muted style={{ marginBottom: 10 }}>
            {shown.length} {shown.length === 1 ? 'item' : 'items'}
          </Muted>
          {category === 'beverages' ? (
            <Wrap>
              <Chip label="All drinks" selected={group === null} onPress={() => setGroup(null)} />
              {BEVERAGE_GROUPS.map((g) => (
                <Chip key={g.id} label={g.label} selected={group === g.id} onPress={() => setGroup(g.id)} />
              ))}
            </Wrap>
          ) : null}
          {shown.map(row)}
        </>
      ) : (
        <>
          <Muted style={{ marginBottom: 10 }}>Choose a category, or search above.</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {tiles.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setCategory(t.id)}
                accessibilityRole="button"
                accessibilityLabel={`${t.label}, ${t.count} items`}
                style={({ pressed }) => ({
                  width: '48%',
                  flexGrow: 1,
                  minWidth: 150,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 14,
                  padding: 14,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{t.label}</Text>
                <Muted style={{ marginTop: 2 }}>{t.hint}</Muted>
                <Text style={{ color: colors.accent, fontWeight: '700', marginTop: 6 }}>{t.count}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
