import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment')
  process.exit(1)
}

const supabase = createClient(url, key)

;(async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').limit(5)
    console.log('error:', error)
    console.log('data:', JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('Exception:', e)
    process.exit(1)
  }
})()
