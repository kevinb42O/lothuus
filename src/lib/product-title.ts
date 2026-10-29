/** Hide an imported inventory prefix without changing the stored product title. */
export function displayProductTitle(title: string) {
  return title.replace(/^\s*[KPGTHI]\d{3}(?:\s*[-–—:]\s*|\s+)(?=\S)/i, '');
}
