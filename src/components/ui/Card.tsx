import {
  createElement,
  forwardRef,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react'

type CardVariant = 'outline' | 'raised' | 'flat'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** `outline` (padrão), `raised` (sombra) ou `flat` (sem sombra). */
  variant?: CardVariant
  /** Quando presente, o card inteiro vira um `<a>` focável e operável por teclado. */
  href?: string
  /** Passados ao `<a>` quando `href` está definido. */
  target?: AnchorHTMLAttributes<HTMLAnchorElement>['target']
  rel?: AnchorHTMLAttributes<HTMLAnchorElement>['rel']
}

const cx = (...parts: Array<string | false | undefined>) =>
  parts.filter(Boolean).join(' ')

const variantClass: Record<CardVariant, string | false> = {
  outline: false,
  raised: 'lia-card--raised',
  flat: 'lia-card--flat',
}

const CardRoot = forwardRef<HTMLElement, CardProps>(function Card(
  { variant = 'outline', href, target, rel, className, children, ...rest },
  ref,
) {
  const classes = cx('lia-card', variantClass[variant], className)

  if (href !== undefined) {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        target={target}
        rel={rel}
        className={classes}
        {...rest}
      >
        {children}
      </a>
    )
  }

  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className={classes} {...rest}>
      {children}
    </div>
  )
})

interface CardImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** `alt` obrigatório: imagem informativa precisa de texto alternativo (WCAG 1.1.1). */
  alt: string
}
function CardMedia({ className, alt, ...rest }: CardImageProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={cx('lia-card__media', className)} alt={alt} {...rest} />
}

function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('lia-card__body', className)} {...rest}>
      {children}
    </div>
  )
}

function CardEyebrow({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cx('lia-card__eyebrow', className)} {...rest}>
      {children}
    </p>
  )
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Nível semântico do título. Padrão `h3` — ajuste à hierarquia da página. */
  as?: 'h2' | 'h3' | 'h4'
  children?: ReactNode
}
function CardTitle({ as = 'h3', className, children, ...rest }: CardTitleProps) {
  return createElement(
    as,
    { className: cx('lia-card__title', className), ...rest },
    children,
  )
}

function CardExcerpt({ className, children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cx('lia-card__excerpt', className)} {...rest}>
      {children}
    </p>
  )
}

function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('lia-card__footer', className)} {...rest}>
      {children}
    </div>
  )
}

export const Card = Object.assign(CardRoot, {
  Media: CardMedia,
  Body: CardBody,
  Eyebrow: CardEyebrow,
  Title: CardTitle,
  Excerpt: CardExcerpt,
  Footer: CardFooter,
})
