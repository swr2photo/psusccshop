// scratch/check-env.ts
import dotenv from 'dotenv';
dotenv.config();

console.log('Environment keys related to SUPABASE or DATABASE:');
const keys = Object.keys(process.env).filter(key => 
  key.includes('SUPABASE') || 
  key.includes('DATABASE') || 
  key.includes('KEY') || 
  key.includes('URL') || 
  key.includes('SERVICE')
);
keys.forEach(key => {
  const val = process.env[key];
  const length = val ? val.length : 0;
  const snippet = val ? (val.startsWith('http') || val.startsWith('postgres') ? val : val.substring(0, 15) + '...') : 'undefined';
  console.log(`- ${key} (len: ${length}): ${snippet}`);
});
