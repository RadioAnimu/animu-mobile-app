import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from "react-native-svg";

interface Props {
  size: number;
  color: string;
}

/** Grille lines across the head, clipped to its circle. */
const GRILLE = [9.5, 12, 14.5];

/**
 * A handheld karaoke microphone — mesh-grille ball head, collar and tapered
 * handle, tilted like the 🎤 emoji. Material Icons has no karaoke glyph, so
 * it is drawn here on the same 24-unit grid as the icon font; one colour, so
 * it dims like any other icon. Decorative: the button carries the label.
 */
export function KaraokeMicIcon({ size, color }: Readonly<Props>) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <ClipPath id="karaoke-head">
          <Circle cx={12} cy={6} r={4.6} />
        </ClipPath>
      </Defs>
      {/* Drawn upright, then tilted 45° so the head leans to the right. */}
      <G transform="rotate(45 12 12)">
        <Circle
          cx={12}
          cy={6}
          r={4.6}
          stroke={color}
          strokeWidth={1.6}
          fill="none"
        />
        <G clipPath="url(#karaoke-head)" stroke={color} strokeWidth={1.1}>
          {GRILLE.map((at) => (
            <G key={at}>
              <Path d={`M${at} 0V12`} />
              <Path d={`M6 ${at - 6}H18`} />
            </G>
          ))}
        </G>
        <Rect x={8.6} y={11.2} width={6.8} height={2.2} rx={0.6} fill={color} />
        <Path
          d="M9.4 13.4H14.6L13.4 22.2a1.4 1.4 0 0 1-2.8 0Z"
          fill={color}
        />
      </G>
    </Svg>
  );
}
