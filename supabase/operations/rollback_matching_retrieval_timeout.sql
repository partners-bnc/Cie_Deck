-- Restore the inherited Data API timeout (currently eight seconds).
alter function public.matching_search(extensions.vector,text[],numeric,boolean,text[],integer,text)
  reset statement_timeout;
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
