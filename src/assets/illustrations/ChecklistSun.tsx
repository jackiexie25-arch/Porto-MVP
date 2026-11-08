import { Frame, type IllustrationProps } from './Frame';
import s from './illustration.module.css';

const ROWS = [100, 128, 156] as const;
const RAYS = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const SUN = { x: 256, y: 64, r: 18 } as const;

function ray(deg: number): string {
  const rad = (deg * Math.PI) / 180;
  const x1 = SUN.x + Math.cos(rad) * (SUN.r + 7);
  const y1 = SUN.y + Math.sin(rad) * (SUN.r + 7);
  const x2 = SUN.x + Math.cos(rad) * (SUN.r + 14);
  const y2 = SUN.y + Math.sin(rad) * (SUN.r + 14);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** 4. A finished checklist and a sun. Used when the first-shift card is complete. */
export function ChecklistSun(props: IllustrationProps) {
  return (
    <Frame
      {...props}
      blob="M46 124C42 70 98 34 166 34C236 34 286 72 284 128C282 186 232 214 164 214C96 214 50 178 46 124Z"
      leaves={[
        { x: 58, y: 176, rotate: -30, tone: 'sky' },
        { x: 72, y: 162, rotate: -75, tone: 'blob' },
        { x: 250, y: 186, rotate: 200, tone: 'blob' },
      ]}
    >
      {/* sun */}
      <circle className={s.apricot} cx={SUN.x} cy={SUN.y} r={SUN.r} />
      <path className={s.line} d={RAYS.map(ray).join('')} />

      {/* clipboard */}
      <path
        className={s.sky}
        d="M104 66C104 61 107 58 112 58L206 58C211 58 214 61 214 66L214 196C214 201 211 204 206 204L112 204C107 204 104 201 104 196Z"
      />
      <path className={s.paper} d="M116 74C140 73 178 73 202 74L202 192C178 193 140 193 116 192Z" />
      <path
        className={s.apricot}
        d="M138 52C138 49 140 48 143 48L175 48C178 48 180 49 180 52L180 62C180 65 178 66 175 66L143 66C140 66 138 65 138 62Z"
      />

      {/* ticked rows */}
      {ROWS.map((y) => (
        <g key={y}>
          <path className={s.paper} d={`M126 ${y - 8}L142 ${y - 8}L142 ${y + 8}L126 ${y + 8}Z`} />
          <path className={s.line} d={`M129 ${y}L133 ${y + 4}L141 ${y - 5}`} />
          <path className={s.thin} d={`M152 ${y}L${y === 156 ? 178 : 190} ${y}`} />
        </g>
      ))}
    </Frame>
  );
}
