-- Give candidate retrieval twenty seconds through the Data API.
-- Scope the limit to this existing restricted RPC; preserve other API timeouts.
alter function public.matching_search(extensions.vector,text[],numeric,boolean,text[],integer,text)
  set statement_timeout = '20s';
notify pgrst, 'reload schema';
notify pgrst, 'reload config';
