import { Frame, type IllustrationProps } from './Frame';
import s from './illustration.module.css';

/** 1. An adult and child side by side, holding hands. Used on the welcome screen. */
export function SideBySide(props: IllustrationProps) {
  return (
    <Frame
      {...props}
      blob="M44 128C38 74 92 34 164 32C236 30 286 66 286 124C286 184 238 214 166 214C96 214 50 182 44 128Z"
      leaves={[
        { x: 52, y: 186, rotate: -35, tone: 'sky' },
        { x: 70, y: 170, rotate: -70, tone: 'blob' },
        { x: 262, y: 168, rotate: 200, tone: 'blob' },
      ]}
    >
      {/* sun */}
      <circle className={s.apricot} cx="250" cy="66" r="14" />
      {/* ground */}
      <path className={s.line} d="M84 205C122 202 198 203 252 206" />

      {/* adult */}
      <path className={s.line} d="M114 59C113 46 124 39 135 40C146 41 152 50 150 60" />
      <path className={s.line} d="M132 42C143 42 150 51 150 61C150 72 142 80 132 80C121 80 114 71 114 61C114 50 121 42 132 42Z" />
      <path className={s.thin} d="M123 61q3 3 6 0M136 61q3 3 6 0M128 69q4 3 8 0" />
      <path className={s.line} d="M132 80L132 88" />
      <path className={s.apricot} d="M114 94C121 87 144 87 151 94L159 160C142 166 121 166 105 160Z" />
      <path className={s.line} d="M114 98C106 116 103 132 106 146" />
      <path className={s.line} d="M150 98C160 114 168 127 178 136" />
      <path className={s.line} d="M121 164L118 202L110 203M144 164L146 202L154 203" />

      {/* child */}
      <path className={s.line} d="M188 107C189 99 197 95 206 98" />
      <path className={s.line} d="M200 98C208 98 214 104 214 112C214 120 208 126 200 126C192 126 186 120 186 112C186 104 192 98 200 98Z" />
      <path className={s.thin} d="M193 112q2.5 2.5 5 0M203 112q2.5 2.5 5 0M196 119q4 2.5 8 0" />
      <path className={s.line} d="M200 126L200 131" />
      <path className={s.sky} d="M187 135C191 131 209 131 213 135L219 174C206 178 192 178 181 174Z" />
      <path className={s.line} d="M188 139C185 140 181 139 178 136" />
      <path className={s.line} d="M212 139C220 150 222 160 220 168" />
      <path className={s.line} d="M192 177L191 202L184 203M208 177L209 202L216 203" />
    </Frame>
  );
}
