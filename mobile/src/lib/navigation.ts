import { Href, router } from 'expo-router';

/** After signing in: close the auth modal and continue to `next` (if any). */
export function goNext(next?: string) {
  if (router.canGoBack()) router.back();
  if (next) router.push(next as Href);
  else if (!router.canGoBack()) router.replace('/');
}
