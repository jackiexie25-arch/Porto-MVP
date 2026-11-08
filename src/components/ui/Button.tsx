import type { ComponentPropsWithRef } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outlined';

interface StyleProps {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

function buttonClass({ variant = 'primary', fullWidth }: StyleProps, extra?: string): string {
  return [styles.button, styles[variant], fullWidth ? styles.fullWidth : '', extra ?? '']
    .filter(Boolean)
    .join(' ');
}

export type ButtonProps = ComponentPropsWithRef<'button'> & StyleProps;

/** Primary: one per screen. Secondary: text link look. Outlined: secondary with a visible edge. */
export function Button({ variant, fullWidth, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, fullWidth }, className)} {...rest} />;
}

export type ButtonLinkProps = LinkProps & StyleProps;

/** A router link that looks like a button. Use when the action is navigation. */
export function ButtonLink({ variant, fullWidth, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass({ variant, fullWidth }, className)} {...rest} />;
}
