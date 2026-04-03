
-- Remove duplicates: keep only the row with the latest created_at per page_id
DELETE FROM public.meta_pages
WHERE id NOT IN (
  SELECT DISTINCT ON (page_id) id
  FROM public.meta_pages
  ORDER BY page_id, created_at DESC
);

-- Now create unique index
CREATE UNIQUE INDEX meta_pages_page_id_unique ON public.meta_pages (page_id);
