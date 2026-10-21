import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../Text';
import { lookupBarcode, PackagedProduct } from '../../lib/barcode';
import { scale } from '../../lib/foods';
import { colors } from '../theme';
import { Button, Card, Field, H2, Muted, n0, n1, parseNum } from '../ui';
import type { LogFn } from './types';

type State =
  | { phase: 'scanning' }
  | { phase: 'loading'; code: string }
  | { phase: 'found'; product: PackagedProduct }
  | { phase: 'error'; message: string };

/** Scan a packaged-food barcode and read its nutrition from Open Food Facts (needs internet). */
export function BarcodeLog({ onLog }: { onLog: LogFn }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ phase: 'scanning' });
  const [grams, setGrams] = useState('100');

  if (!permission) return <ActivityIndicator />;
  if (!permission.granted) {
    return (
      <View>
        <Muted style={{ marginBottom: 10 }}>Camera access is needed to scan barcodes.</Muted>
        <Button title="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  const onScanned = async (code: string) => {
    setState({ phase: 'loading', code });
    const res = await lookupBarcode(code);
    if (res.ok) {
      setGrams(String(res.product.servingGrams ?? 100));
      setState({ phase: 'found', product: res.product });
      return;
    }
    const message =
      res.reason === 'network'
        ? 'Could not reach the product database. Check your internet connection.'
        : res.reason === 'no-nutrition'
          ? 'That product is listed but has no nutrition values. Use Quick add instead.'
          : 'Product not found. Use Quick add to type the label values.';
    setState({ phase: 'error', message });
  };

  if (state.phase === 'found') {
    const { product } = state;
    const g = parseNum(grams);
    const n = g > 0 ? scale(product.per100, g / 100) : null;
    return (
      <Card>
        <H2>{product.name}</H2>
        {product.diet === 'non-veg' ? (
          <Text style={{ color: colors.red, fontWeight: '700', marginBottom: 8 }}>Listed as non-vegetarian</Text>
        ) : product.diet === 'unknown' ? (
          <Muted style={{ marginBottom: 8 }}>Vegetarian status unknown — check the label.</Muted>
        ) : null}
        <Muted style={{ marginBottom: 8 }}>
          Per 100 g: {n0(product.per100.kcal)} kcal · {n1(product.per100.protein)} g protein
        </Muted>
        <Field label="Amount eaten (grams / ml)" value={grams} onChangeText={setGrams} keyboardType="decimal-pad" />
        {n ? (
          <Text style={{ color: colors.text, fontSize: 16, marginBottom: 12 }}>
            <Text style={{ fontWeight: '800' }}>{n0(n.kcal)} kcal</Text> · {n1(n.protein)} g protein
          </Text>
        ) : null}
        <Button
          title="Add to log"
          disabled={!n}
          onPress={() => n && void onLog({ name: product.name, qty: `${n0(g)} g`, ...n, source: 'barcode' })}
        />
        <Button title="Scan another" kind="secondary" onPress={() => setState({ phase: 'scanning' })} />
      </Card>
    );
  }

  return (
    <View>
      <View style={{ height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', marginBottom: 12 }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={state.phase === 'scanning' ? ({ data }) => void onScanned(data) : undefined}
        />
      </View>
      {state.phase === 'loading' ? <Muted>Looking up {state.code}…</Muted> : null}
      {state.phase === 'scanning' ? <Muted>Point the camera at the barcode on the pack.</Muted> : null}
      {state.phase === 'error' ? (
        <>
          <Text style={{ color: colors.red, marginBottom: 8 }}>{state.message}</Text>
          <Button title="Try again" kind="secondary" onPress={() => setState({ phase: 'scanning' })} />
        </>
      ) : null}
    </View>
  );
}
