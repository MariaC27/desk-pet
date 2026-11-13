// A sealed pixel-art note in the app's palette and outline style, for the welcome page.
// Drawn as SVG squares so it stays crisp at any size.
import { PALETTE } from '../../app/src/pet/sprite'

const ART = [
  'oooooooooooooooooo',
  'onmmmmmmmmmmmmmmno',
  'omnmmmmmmmmmmmmnmo',
  'ommnmmmmmmmmmmnmmo',
  'ommmnmmmmmmmmnmmmo',
  'ommmmnmmmmmmnmmmmo',
  'ommmmmkkmmkkmmmmmo',
  'ommmmmkkkkkkmmmmmo',
  'ommmmmmkkkKmmmmmmo',
  'ommmmmmmkKmmmmmmmo',
  'ommmmmmmmmmmmmmmmo',
  'oooooooooooooooooo',
]
// sparkles around the envelope: [x, y] in the same pixel grid, outside the art
const SPARKLES = [
  [-3, 1],
  [20, 3],
  [-2, 9],
]

export function PixelEnvelope({ size = 7 }: { size?: number }) {
  const w = ART[0].length
  const h = ART.length
  return (
    <svg
      className="pixel-envelope"
      viewBox={`-4 -1 ${w + 8} ${h + 2}`}
      width={(w + 8) * size}
      height={(h + 2) * size}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <g className="pixel-envelope-body">
        {ART.flatMap((row, y) =>
          [...row].map((c, x) => <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={PALETTE[c]} />),
        )}
      </g>
      {SPARKLES.map(([x, y], i) => (
        <rect key={i} className="pixel-sparkle" x={x} y={y} width={1} height={1} fill={PALETTE.y} style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
    </svg>
  )
}
