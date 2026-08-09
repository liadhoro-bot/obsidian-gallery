import type { ButtonHTMLAttributes, CSSProperties } from 'react'

import { cx } from '../utils'
import styles from '../primitives.module.css'

export type OgPaintSwatchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & {
  color: string
  label: string
  shape?: 'square' | 'circle' | 'strip'
  size?: string
}

export function OgPaintSwatch({
  className,
  color,
  label,
  shape = 'square',
  size,
  style,
  type = 'button',
  ...props
}: OgPaintSwatchProps) {
  const swatchStyle = {
    ...style,
    '--og-swatch-color': color,
    ...(size ? { '--og-swatch-size': size } : null),
  } as CSSProperties

  return (
    <button
      {...props}
      aria-label={label}
      className={cx(styles.paintSwatch, className)}
      data-shape={shape}
      style={swatchStyle}
      type={type}
    />
  )
}
