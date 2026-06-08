// scratch/test-anon-storage.ts
import 'dotenv/config';
import { supabase } from '../src/lib/supabase';

async function main() {
  console.log('Testing storage operations using the public supabase client (anon key)...');
  
  // 1. List buckets to verify connection
  try {
    const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
    if (bucketsErr) {
      console.error('Failed to list buckets:', bucketsErr.message, bucketsErr);
      return;
    }
    console.log('Successfully connected. Buckets found:', buckets.map(b => b.name));
  } catch (err: any) {
    console.error('Exception during listBuckets:', err.message || err);
    return;
  }
  
  // 2. Upload dummy text/image to test insert policy
  const dummyBuffer = Buffer.from('this is dummy image content for testing');
  const filename = 'test_upload_anon.png';
  const contentType = 'image/png';
  
  const now = new Date();
  const path = `test-runs/${now.getFullYear()}_${Date.now()}.png`;
  
  try {
    console.log(`Uploading test file to images bucket at path: ${path}...`);
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('images')
      .upload(path, dummyBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      });
      
    if (uploadErr) {
      console.error('Upload failed:', uploadErr.message, uploadErr);
      return;
    }
    
    console.log('Upload succeeded! Data:', uploadData);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(path);
      
    console.log('Public URL for the file:', urlData.publicUrl);
    
    // 3. Delete dummy file to test delete policy
    console.log(`Cleaning up test file at path: ${path}...`);
    const { data: deleteData, error: deleteErr } = await supabase.storage
      .from('images')
      .remove([path]);
      
    if (deleteErr) {
      console.error('Clean up failed:', deleteErr.message, deleteErr);
    } else {
      console.log('Clean up succeeded! Test complete.');
    }
  } catch (err: any) {
    console.error('Exception during upload/delete:', err.message || err);
  }
}

main();
