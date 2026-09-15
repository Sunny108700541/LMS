import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import { env } from '../src/config/env';

async function testHeaderCombinations() {
  const configs: Array<{ name: string; options: SupabaseClientOptions<any> }> = [
    { name: 'Default', options: { auth: { persistSession: false } } },
    {
      name: 'With Service Role Header',
      options: {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } },
      },
    },
    {
      name: 'With X-Supabase-Role header',
      options: {
        auth: { persistSession: false },
        global: { headers: { 'X-Supabase-Role': 'service_role' } },
      },
    },
  ];

  for (const cfg of configs) {
    console.log(`\nTesting: ${cfg.name}`);
    const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, cfg.options);

    const testBuffer = Buffer.from('test pdf content');
    const path = `test/test-${Date.now()}.pdf`;

    const { data, error } = await client
      .storage.from(env.SUPABASE_BUCKET)
      .upload(path, testBuffer, { contentType: 'application/pdf', upsert: true });

    if (error) {
      console.error('  Result:', error.message);
    } else {
      console.log('  SUCCESS! Uploaded to:', data.path);
      await client.storage.from(env.SUPABASE_BUCKET).remove([path]);
    }
  }
}

testHeaderCombinations();
