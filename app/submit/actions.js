 'use server';

// Compatibility guard for stale browser bundles. The legacy form and its
// public-flyer upload path are retired; all new intake uses /panther-submit.
export async function submitContentAction() {
  return { ok: false, error: 'This submission path has been retired. Use Panther Hub contributor intake.' };
}
