import { Frame, type IllustrationProps } from './Frame';
import s from './illustration.module.css';

/** 2. A worker reading the profile on a phone. Used for the empty worker search. */
export function WorkerPhone(props: IllustrationProps) {
  return (
    <Frame
      {...props}
      blob="M50 120C46 66 104 30 170 34C240 38 284 76 280 132C276 188 226 214 160 212C94 210 54 172 50 120Z"
      leaves={[
        { x: 60, y: 96, rotate: -20, tone: 'blob' },
        { x: 70, y: 112, rotate: 30, tone: 'sky' },
        { x: 258, y: 82, rotate: 160, tone: 'blob' },
      ]}
    >
      <path className={s.line} d="M90 206C130 203 200 203 244 206" />

      {/* worker */}
      <path className={s.line} d="M131 66C128 49 139 38 151 38C165 38 174 50 171 66C174 76 176 86 170 92" />
      <path className={s.line} d="M150 42C161 42 168 51 168 62C168 73 160 81 150 81C139 81 132 72 132 62C132 51 139 42 150 42Z" />
      <path className={s.thin} d="M141 64q3 2.5 6 0M154 64q3 2.5 6 0M146 72q4 2.5 8 0" />
      <path className={s.line} d="M150 81L150 89" />
      <path className={s.rose} d="M131 95C138 88 162 88 169 95L177 166C160 172 140 172 123 166Z" />
      <path className={s.line} d="M138 170L136 204L128 205M162 170L164 204L172 205" />

      {/* phone, held in both hands */}
      <path
        className={s.sky}
        d="M139 112L161 110C163 110 164 111 164 113L166 140C166 142 165 143 163 143L141 145C139 145 138 144 138 142L136 115C136 113 137 112 139 112Z"
      />
      <path className={s.thin} d="M143 120L158 119M143 126L156 125M143 132L152 131" />
      <path className={s.line} d="M132 99C122 118 126 133 140 135" />
      <path className={s.line} d="M168 99C178 118 175 131 163 133" />

      {/* plant */}
      <path className={s.apricot} d="M222 178L246 178L242 204L226 204Z" />
      <path className={s.line} d="M234 178C233 164 228 154 220 148M234 178C236 164 242 156 250 150" />
      <path className={s.sky} d="M220 148C213 143 213 134 219 129C226 134 226 143 220 148Z" />
      <path className={s.sky} d="M250 150C255 143 263 142 268 146C263 153 255 154 250 150Z" />
    </Frame>
  );
}
