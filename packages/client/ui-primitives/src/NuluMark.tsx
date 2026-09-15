import type { IconProps } from './icons/props.ts'

/** Native viewBox of {@link NULU_MARK_PATH} (width and height in user units). */
export const NULU_MARK_VIEWBOX = { width: 24, height: 24 }

/** The Nulu monogram path data, exported for consumers that compose their own svg (entrance effects, masks) around the same geometry. */
export const NULU_MARK_PATH = 'M4.5 3.5h3.6v17H4.5zM15.9 3.5h3.6v17h-3.6zM7.6 3.5h3.4L15.9 15.6v4.9h-3.4L7.6 8.9z'

/**
 * Render the Nulu mark.
 * @param props.size - edge length in px (default 24; the mark is square).
 * @param props.className - extra class for layout placement.
 * @returns the mark svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function NuluMark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox={`0 0 ${NULU_MARK_VIEWBOX.width} ${NULU_MARK_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={NULU_MARK_PATH} fill="currentColor" />
    </svg>
  )
}
