import type { ComponentPropsWithoutRef, ElementType } from 'react';
import styles from './Card.module.css';

type CardProps<T extends ElementType> = {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, 'as'>;

/** Surface panel: white, large radius, lavender border, no shadow. */
export function Card<T extends ElementType = 'div'>({ as, className, ...rest }: CardProps<T>) {
  const Tag: ElementType = as ?? 'div';
  return <Tag className={[styles.card, className ?? ''].join(' ')} {...rest} />;
}

/** Stacks cards with the standard card gap. */
export function CardStack({ className, ...rest }: ComponentPropsWithoutRef<'div'>) {
  return <div className={[styles.stack, className ?? ''].join(' ')} {...rest} />;
}
