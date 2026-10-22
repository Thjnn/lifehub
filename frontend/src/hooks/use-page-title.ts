import { useMatches } from 'react-router'

// Title comes from the deepest route with `handle: { title }` (see app/router.tsx).
export function usePageTitle() {
  const matches = useMatches()
  for (let i = matches.length - 1; i >= 0; i--) {
    const title = (matches[i].handle as { title?: string } | undefined)?.title
    if (title) return title
  }
  return 'LIFEHUB'
}
