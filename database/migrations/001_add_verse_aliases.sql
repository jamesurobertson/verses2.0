-- Add aliases column to verses table for efficient reference lookup
-- This allows multiple ways to reference the same verse (jn 1:1, john 1:1, etc.)

-- Add the aliases column as TEXT array
ALTER TABLE public.verses 
ADD COLUMN aliases TEXT[] DEFAULT '{}';

-- Create GIN index for fast alias lookups
CREATE INDEX idx_verses_aliases ON public.verses USING GIN (aliases);

-- Update existing verses to include their canonical reference as first alias
-- This ensures backwards compatibility
UPDATE public.verses 
SET aliases = ARRAY[LOWER(TRIM(reference))]
WHERE aliases = '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.verses.aliases IS 'Array of normalized reference formats that point to this verse (e.g. ["jn 1:1", "john 1:1"])';