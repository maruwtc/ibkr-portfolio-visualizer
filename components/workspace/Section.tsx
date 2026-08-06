'use client';

import React from 'react';

import { cn } from '@/lib/utils';

/**
 * A titled block of panel content.
 *
 * On phones it is a plain section separated by a rule: the page already supplies
 * padding, so wrapping each block in its own bordered card stacks three levels of
 * chrome and leaves very little width for the content. From lg up it takes the card
 * treatment the desktop layout is built around.
 */
export default function Section({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn('border-b pb-4 last:border-b-0 last:pb-0 lg:rounded-2xl lg:border lg:p-4', className)}>
      {(title || description) && (
        <div className="mb-3">
          {title && <div className="text-sm text-muted-foreground">{title}</div>}
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
