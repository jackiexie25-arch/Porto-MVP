import { Frame, type IllustrationProps } from './Frame';
import s from './illustration.module.css';

/** 5. A sun over a calm wave, echoing the mark. Used when a share link has closed. */
export function CalmWave(props: IllustrationProps) {
  return (
    <Frame
      {...props}
      blob="M48 126C44 72 98 36 164 36C234 36 282 72 280 128C278 184 230 212 164 212C98 212 52 180 48 126Z"
      leaves={[
        { x: 62, y: 84, rotate: -25, tone: 'blob' },
        { x: 252, y: 178, rotate: 200, tone: 'sky' },
        { x: 268, y: 164, rotate: 150, tone: 'blob' },
      ]}
    >
      <circle className={s.apricot} cx="160" cy="102" r="42" />
      <path className={s.line} d="M78 146q20.5 -20 41 0t41 0t41 0t41 0" />
      <path className={s.skyLine} d="M98 172q15.5 -14 31 0t31 0t31 0t31 0" />
    </Frame>
  );
}
