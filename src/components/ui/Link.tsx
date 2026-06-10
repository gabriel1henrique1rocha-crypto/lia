import { forwardRef, type AnchorHTMLAttributes } from 'react'
import { ExternalLink } from 'lucide-react'

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** `default` (sublinhado) ou `quiet` (sublinha só no hover — uso restrito). */
  variant?: 'default' | 'quiet'
  /**
   * Link externo: abre em nova aba com `rel="noopener noreferrer"` e
   * acrescenta o ícone `ExternalLink` (decorativo, `aria-hidden`).
   */
  external?: boolean
}

const cx = (...parts: Array<string | false | undefined>) =>
  parts.filter(Boolean).join(' ')

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { variant = 'default', external = false, className, children, target, rel, ...rest },
  ref,
) {
  return (
    <a
      ref={ref}
      className={cx('lia-link', variant === 'quiet' && 'lia-link--quiet', className)}
      target={external ? '_blank' : target}
      rel={external ? 'noopener noreferrer' : rel}
      {...rest}
    >
      {children}
      {external && (
        <ExternalLink className="lia-link__external" size={14} aria-hidden="true" />
      )}
    </a>
  )
})
