import { useEffect } from 'react'

import { pageTitle } from '../utils/formatters.js'

/** Sets `document.title` for the current page, restoring it on unmount. */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = pageTitle(title)
  }, [title])
}
