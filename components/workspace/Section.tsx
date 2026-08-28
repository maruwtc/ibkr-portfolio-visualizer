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
 *
 * The rule utilities are scoped with `max-lg:` rather than left unprefixed. A bare
 * `last:border-b-0` is a class *and* a pseudo-class, so it outranks `lg:border` on
 * specificity — media queries contribute none — and silently stripped the bottom
 * border and padding from whichever card fell last in its container.
 */
export default function Section({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  /** Rendered opposite the title — a total, a period, a legend note. */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'max-lg:border-b max-lg:pb-4 max-lg:last:border-b-0 max-lg:last:pb-0',
        'lg:flex lg:flex-col lg:rounded-2xl lg:border lg:p-4',
        className
      )}
    >
      {(title || description || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <div className="text-sm font-medium text-foreground">{title}</div>}
            {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {/* Cards in a row are stretched to a common height, so the body claims the slack
          and short content can centre itself in it rather than stranding a void. */}
      <div className="lg:flex lg:flex-1 lg:flex-col lg:justify-center">{children}</div>
    </section>
  );
}
