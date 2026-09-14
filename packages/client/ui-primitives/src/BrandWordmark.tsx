import type { IconProps } from './icons/props.ts'
import { NULU_MARK_PATH, NULU_MARK_VIEWBOX } from './NuluMark.tsx'

/** Display options for the Nulu brand wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading mark; defaults to true. */
  includeMark?: boolean | undefined
}

/** Full wordmark canvas: square mark, gap, then the product name. */
const CANVAS = { withMark: 168, nameOnly: 136 }
/** Left edge of the name artwork when the mark is omitted. */
const NAME_X = NULU_MARK_VIEWBOX.width + 8

/**
 * Render the full brand wordmark.
 * @param props.size - height in px (default 24; width follows the selected artwork).
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - whether to include the leading mark.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const width = includeMark ? CANVAS.withMark : CANVAS.nameOnly
  return (
    <svg
      width={(size * width) / 24}
      height={size}
      className={className}
      viewBox={includeMark ? `0 0 ${CANVAS.withMark} 24` : `${NAME_X} 0 ${CANVAS.nameOnly} 24`}
      fill="none"
      aria-hidden="true"
    >
      {includeMark && <path d={NULU_MARK_PATH} fill="currentColor" />}
      <text
        x={NAME_X}
        y={17.5}
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="19.5"
        fontWeight="600"
        letterSpacing="-0.2"
      >
        Nulu Harness
      </text>
    </svg>
  )
}
