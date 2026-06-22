'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { BreadcrumbEntry } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  backHref?: string
  backLabel?: string
  breadcrumbs?: BreadcrumbEntry[]
  className?: string
  /** Dark theme pages (sales/admin) use light text */
  variant?: 'default' | 'dark'
}

export default function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  breadcrumbs,
  className,
  variant = 'default',
}: PageHeaderProps) {
  const isDark = variant === 'dark'
  const titleCls = isDark ? 'text-white' : 'text-foreground'
  const descCls = isDark ? 'text-zinc-400' : 'text-muted-foreground'
  const backCls = isDark
    ? 'text-zinc-400 hover:text-white'
    : 'text-muted-foreground hover:text-foreground'
  const crumbMuted = isDark ? 'text-zinc-500' : 'text-muted-foreground'
  const crumbActive = isDark ? 'text-zinc-300' : 'text-foreground'

  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 1 && (
        <Breadcrumb className="mb-3">
          <BreadcrumbList className={crumbMuted}>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1
              return (
                <span key={crumb.href} className="contents">
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className={crumbActive}>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href} className={cn('hover:opacity-90', crumbMuted)}>
                          {crumb.label}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </span>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {backHref && (
        <Link
          href={backHref}
          className={cn(
            'inline-flex items-center gap-1 text-sm font-medium mb-3 transition-colors',
            backCls,
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          {backLabel ?? 'Back'}
        </Link>
      )}

      <div>
        <h1 className={cn('text-2xl sm:text-3xl font-bold tracking-tight', titleCls)}>{title}</h1>
        {description && (
          <p className={cn('text-sm mt-1', descCls)}>{description}</p>
        )}
      </div>
    </div>
  )
}
