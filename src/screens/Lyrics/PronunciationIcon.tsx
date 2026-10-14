import Svg, { Defs, Line, Mask, Path, Rect, Text } from "react-native-svg";
import { THEME } from "@/theme";

/** Which pronunciation glyph: the menu's own, or one of its modes. */
export type PronunciationGlyph = "menu" | "romaji" | "hiragana" | "off";

interface Props {
  glyph: PronunciationGlyph;
  size: number;
  color?: string;
}

/** Material's chat bubble (24 grid): one bubble, tail bottom-left. */
const BUBBLE = "M4 2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2z";
/** The menu's pair: a back bubble (tail left) under a front one (tail right). */
const BACK = "M4 1.5h8.5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6l-4 3.5v-11.5a2 2 0 0 1 2-2z";
const FRONT = "M11.5 8.5H20a2 2 0 0 1 2 2V22l-4-3.5h-6.5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z";
/** Gap kept between the overlapping bubbles (stroke width: twice the gap). */
const GAP = 3;

const FULL = { x: 0, y: 0, width: 24, height: 24, maskUnits: "userSpaceOnUse" } as const;

/** A glyph knocked out of a bubble (black in a mask = cut through). */
function Cut({ x, y, size, children }: Readonly<{ x: number; y: number; size: number; children: string }>) {
  return (
    <Text x={x} y={y} fontSize={size} fontWeight="800" fill="black" textAnchor="middle">
      {children}
    </Text>
  );
}

/**
 * The lyrics pronunciation icons, in the app's solid (Material filled)
 * style: speech bubbles with their letters cut clean through, so whatever
 * is behind — the glass — shows in them. The menu's glyph is Apple Music's
 * pair, "A" and "文"; romaji and hiragana are one bubble with "A" / "あ";
 * off is the bubble struck through, Material's "_off" way.
 */
export function PronunciationIcon({ glyph, size, color = THEME.COLORS.TEXT }: Readonly<Props>) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {glyph === "menu" ? <Pair color={color} /> : <Single glyph={glyph} color={color} />}
    </Svg>
  );
}

function Pair({ color }: Readonly<{ color: string }>) {
  return (
    <>
      <Defs>
        <Mask id="back" {...FULL}>
          <Rect {...FULL} fill="white" />
          <Path d={FRONT} fill="black" stroke="black" strokeWidth={GAP} strokeLinejoin="round" />
          <Cut x={7.9} y={9.2} size={8}>
            A
          </Cut>
        </Mask>
        <Mask id="front" {...FULL}>
          <Rect {...FULL} fill="white" />
          <Cut x={15.75} y={16.3} size={7.5}>
            文
          </Cut>
        </Mask>
      </Defs>
      <Path d={BACK} fill={color} mask="url(#back)" />
      <Path d={FRONT} fill={color} mask="url(#front)" />
    </>
  );
}

function Single({ glyph, color }: Readonly<{ glyph: Exclude<PronunciationGlyph, "menu">; color: string }>) {
  return (
    <>
      <Defs>
        <Mask id="single" {...FULL}>
          <Rect {...FULL} fill="white" />
          {glyph === "romaji" ? (
            <Cut x={12} y={14.1} size={11}>
              A
            </Cut>
          ) : null}
          {glyph === "hiragana" ? (
            <Cut x={12} y={14.2} size={10.5}>
              あ
            </Cut>
          ) : null}
          {glyph === "off" ? <Line x1={1} y1={1} x2={23} y2={23} stroke="black" strokeWidth={5} /> : null}
        </Mask>
      </Defs>
      <Path d={BUBBLE} fill={color} mask="url(#single)" />
      {glyph === "off" ? (
        <Line x1={2.5} y1={2.5} x2={21.5} y2={21.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
      ) : null}
    </>
  );
}
