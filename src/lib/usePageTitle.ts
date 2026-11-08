import { useEffect } from 'react';
import { copy } from '../copy/en-AU';

/** Sets the tab title to "Page name · Porto". */
export function usePageTitle(page: string) {
  useEffect(() => {
    document.title = copy.meta.pageTitle(page);
  }, [page]);
}
