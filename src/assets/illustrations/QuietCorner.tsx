import { Frame, type IllustrationProps } from './Frame';
import s from './illustration.module.css';

/** 3. A quiet corner with a cushion, headphones and a plant. Used on the overstimulation section. */
export function QuietCorner(props: IllustrationProps) {
  return (
    <Frame
      {...props}
      blob="M40 130C36 76 90 36 162 34C232 32 288 70 286 128C284 186 234 216 162 214C92 212 44 184 40 130Z"
      leaves={[
        { x: 56, y: 176, rotate: -40, tone: 'blob' },
        { x: 64, y: 192, rotate: 10, tone: 'sky' },
        { x: 272, y: 64, rotate: 140, tone: 'blob' },
      ]}
    >
      {/* window */}
      <path className={s.line} d="M112 56C132 55 152 55 172 56L171 104C151 105 131 105 112 104Z" />
      <path className={s.thin} d="M142 56L142 104M112 80L171 80" />

      {/* floor */}
      <path className={s.line} d="M72 199C122 196 210 196 270 199" />

      {/* cushion */}
      <path className={s.sky} d="M92 178C90 156 120 146 160 146C200 146 230 156 228 178C226 192 196 198 160 198C124 198 94 192 92 178Z" />
      <path className={s.thin} d="M122 162C142 168 178 168 198 162" />

      {/* headphones resting on the cushion */}
      <path className={s.line} d="M136 146C133 118 187 118 184 146" />
      <path className={s.thin} d="M141 145C139 126 181 126 179 145" />
      <path className={s.apricot} d="M128 143C128 140 130 139 133 139L139 139C142 139 143 141 143 144L143 158C143 161 141 162 139 162L133 162C130 162 128 160 128 157Z" />
      <path className={s.apricot} d="M177 144C177 141 178 139 181 139L187 139C190 139 192 140 192 143L192 157C192 160 190 162 187 162L181 162C179 162 177 161 177 158Z" />

      {/* plant */}
      <path className={s.rose} d="M237 162L263 162L258 198L242 198Z" />
      <path className={s.line} d="M234 162L266 162" />
      <path className={s.line} d="M250 162C249 146 244 134 234 124M250 162C252 148 258 138 268 130M250 162L250 114" />
      <path className={s.sky} d="M234 124C226 120 224 112 228 106C236 110 238 118 234 124Z" />
      <path className={s.sky} d="M268 130C276 126 280 118 278 112C270 114 266 122 268 130Z" />
      <path className={s.sky} d="M250 114C244 108 244 100 250 94C256 100 256 108 250 114Z" />
    </Frame>
  );
}
