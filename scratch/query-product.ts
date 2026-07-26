// scratch/query-product.ts
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY2 || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying supabase for product...');
  // We can query products table. Let's find columns or just select all.
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('name', '%New Product%');
  
  if (error) {
    console.error('Error querying products:', error);
    return;
  }
  
  console.log('Found products count:', data?.length);
  console.log(JSON.stringify(data, null, 2));
}

run();
