-- Migration to add date_of_joining to employees table
ALTER TABLE public.employees 
ADD COLUMN date_of_joining DATE NOT NULL DEFAULT CURRENT_DATE;
