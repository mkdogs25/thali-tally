import { useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { daysBetween } from '../lib/dates';
import { colors, SERIF } from './theme';

export interface Point {
  date: string;
  kg: number;
}

/** Logged weights (solid) against the planned glide path (dashed). */
export function WeightChart({ actual, planned }: { actual: Point[]; planned: Point[] }) {
  const { width: screen } = useWindowDimensions();
  const width = screen - 32 - 32; // screen padding + card padding
  const height = 190;
  const pad = { l: 38, r: 8, t: 10, b: 22 };

  const all = [...actual, ...planned];
  if (all.length === 0) return null;
  const firstDate = all.map((p) => p.date).sort()[0];
  const lastDate = all.map((p) => p.date).sort().slice(-1)[0];
  const span = Math.max(1, daysBetween(firstDate, lastDate));
  const kgs = all.map((p) => p.kg);
  const min = Math.floor(Math.min(...kgs) - 1);
  const max = Math.ceil(Math.max(...kgs) + 1);

  const x = (date: string) => pad.l + (daysBetween(firstDate, date) / span) * (width - pad.l - pad.r);
  const y = (kg: number) => pad.t + (1 - (kg - min) / Math.max(1, max - min)) * (height - pad.t - pad.b);
  const line = (pts: Point[]) => pts.map((p) => `${x(p.date)},${y(p.kg)}`).join(' ');
  const ticks = [min, (min + max) / 2, max];

  return (
    <Svg width={width} height={height} accessibilityLabel="Weight over time chart">
      {ticks.map((t) => (
        <Line key={t} x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
      ))}
      {ticks.map((t) => (
        <SvgText fontFamily={SERIF} key={`l${t}`} x={pad.l - 6} y={y(t) + 4} fontSize={11} fill={colors.muted} textAnchor="end">
          {Math.round(t * 10) / 10}
        </SvgText>
      ))}
      <SvgText fontFamily={SERIF} x={pad.l} y={height - 4} fontSize={11} fill={colors.muted}>{firstDate.slice(5)}</SvgText>
      <SvgText fontFamily={SERIF} x={width - pad.r} y={height - 4} fontSize={11} fill={colors.muted} textAnchor="end">{lastDate.slice(5)}</SvgText>
      {planned.length > 1 ? <Polyline points={line(planned)} fill="none" stroke={colors.muted} strokeWidth={2} strokeDasharray="6 5" /> : null}
      {actual.length > 1 ? <Polyline points={line(actual)} fill="none" stroke={colors.accent} strokeWidth={3} /> : null}
      {actual.map((p) => (
        <Circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={4} fill={colors.accent} />
      ))}
    </Svg>
  );
}
