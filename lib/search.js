export function normalizeSearch(value=''){return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ')}
export function matchesSearch(fields,query){const q=normalizeSearch(query);if(!q)return true;const hay=normalizeSearch(fields.filter(Boolean).join(' '));return q.split(' ').every(token=>hay.includes(token));}
