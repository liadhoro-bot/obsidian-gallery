import type { ElementType, HTMLAttributes, ReactNode } from 'react'

import { cx } from '../utils'
import styles from '../primitives.module.css'

type OgTextProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  children: ReactNode
}

type TextPrimitiveProps = OgTextProps & {
  defaultElement: ElementType
  variantClassName: string
}

function TextPrimitive({
  as,
  children,
  className,
  defaultElement,
  variantClassName,
  ...props
}: TextPrimitiveProps) {
  const Component = as || defaultElement

  return (
    <Component {...props} className={cx(variantClassName, className)}>
      {children}
    </Component>
  )
}

export function OgPageTitle(props: OgTextProps) {
  return <TextPrimitive {...props} defaultElement="h1" variantClassName={styles.pageTitle} />
}

export function OgObjectTitle(props: OgTextProps) {
  return <TextPrimitive {...props} defaultElement="h2" variantClassName={styles.objectTitle} />
}

export function OgSectionHeading(props: OgTextProps) {
  return <TextPrimitive {...props} defaultElement="h3" variantClassName={styles.sectionHeading} />
}

export function OgSubtitle(props: OgTextProps) {
  return <TextPrimitive {...props} defaultElement="p" variantClassName={styles.subtitle} />
}

export function OgBodyText(props: OgTextProps) {
  return <TextPrimitive {...props} defaultElement="p" variantClassName={styles.bodyText} />
}

export function OgCaption(props: OgTextProps) {
  return <TextPrimitive {...props} defaultElement="p" variantClassName={styles.caption} />
}

export function OgTechnicalValue(props: OgTextProps) {
  return <TextPrimitive {...props} defaultElement="span" variantClassName={styles.technicalValue} />
}
