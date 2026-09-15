import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env';

async function testWithKey(keyName: string, keyVal: string) {
  console.log(`\n--- Testing ${keyName} ---`);
  console.log('Key prefix:', keyVal.substring(0, 15));

  const client = createClient(env.SUPABASE_URL, keyVal, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${keyVal}`,
      },
    },
  });

  const testBuffer = Buffer.from('test pdf content');
  const path = `test/test-${Date.now()}.pdf`;

  const { data, error } = await client
    .storage.from(env.SUPABASE_BUCKET)
    .upload(path, testBuffer, { contentType: 'application/pdf', upsert: true });

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('SUCCESS! Uploaded to:', data.path);
    await client.storage.from(env.SUPABASE_BUCKET).remove([path]);
    console.log('Cleaned up test file.');
  }
}

async function run() {
  await testWithKey('Current ENV Key', env.SUPABASE_SERVICE_ROLE_KEY);
  await testWithKey('sb_secret_ key variant', env.SUPABASE_SERVICE_ROLE_KEY.replace('sb_publishable_', 'sb_secret_'));
}

run();
