-- 1. Add categories_enabled to platform_config
ALTER TABLE public.platform_config
ADD COLUMN IF NOT EXISTS categories_enabled boolean DEFAULT true;

-- 2. Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create policies for categories
DROP POLICY IF EXISTS "Allow public read access to categories" ON public.categories;
CREATE POLICY "Allow public read access to categories" ON public.categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service role full access to categories" ON public.categories;
CREATE POLICY "Allow service role full access to categories" ON public.categories
  FOR ALL USING (true) WITH CHECK (true);

-- Insert initial default categories if they don't exist
INSERT INTO public.categories (name, is_active)
VALUES 
  ('Men', true),
  ('Women', true),
  ('Unisex', true),
  ('Pets', true),
  ('Bridal', true)
ON CONFLICT (name) DO NOTHING;
