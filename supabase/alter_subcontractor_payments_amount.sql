-- Run this script in your Supabase SQL Editor:
-- It alters the amount column of public.subcontractor_payments from bigint to numeric(20, 2)
-- to allow decimal/fractional currency values (Turkish Lira & kuruş).

ALTER TABLE public.subcontractor_payments 
  ALTER COLUMN amount TYPE numeric(20, 2);
