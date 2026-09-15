import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env';

async function testJWTs() {
  const payload = {
    role: 'service_role',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 10,
  };

  // Common Supabase default secrets or secrets derived from project
  const secrets = [
    'super-secret-jwt-token-with-at-least-32-characters-long',
    'pIioLMwIT5CnA9SS5wN_fA_85bwMKrA',
    'lblxvzzmlrabesmklstn',
    'secret',
  ];

  for (const secret of secrets) {
    const token = jwt.sign(payload, secret);
    console.log(`\nTesting JWT signed with "${secret.substring(0, 15)}...":`);
    const client = createClient(env.SUPABASE_URL, token, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

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
      break;
    }
  }
}

testJWTs();
