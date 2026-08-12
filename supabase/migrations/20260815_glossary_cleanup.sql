-- T7/T10 hygiene: the full 377-term seed is authoritative.
-- 1) Strip inline [n] citation markers and collapse whitespace in
--    definitions (the REST/scraped bodies embed "[1]" throughout).
-- 2) Drop the 16 T7 stub rows whose names don't exist in the full seed
--    (spelling variants like "Pour-Over" vs the seed's naming) — otherwise
--    the app would render near-duplicate chips.

update public.glossary_terms
set definition = regexp_replace(
      regexp_replace(definition, '\[[0-9]+\]', '', 'g'),
      '[[:space:]]{2,}', ' ', 'g')
where definition ~ '\[[0-9]+\]';

delete from public.glossary_terms
where term in (
  'Acidity', 'Aftertaste', 'Arabica', 'Body', 'Brightness', 'Cold Brew',
  'Crema', 'Extraction', 'Fermentation', 'French Press', 'Honey Process',
  'Moka Pot', 'Mouthfeel', 'Natural Process', 'Pour-Over', 'Washed Process'
);
