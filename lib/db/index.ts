import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import * as schema from './schema'

// Neon's serverless driver needs a WebSocket implementation in Node runtimes.
if (!neonConfig.webSocketConstructor) {
  neonConfig.webSocketConstructor = ws
}

let _db: NeonDatabase<typeof schema> | null = null

function getDb(): NeonDatabase<typeof schema> {
  if (_db) return _db
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  _db = drizzle(new Pool({ connectionString }), { schema })
  return _db
}

// Lazy proxy: defers connection to first runtime use, so `next build` doesn't need a DB.
export const db = new Proxy({} as NeonDatabase<typeof schema>, {
  get(_t, prop) {
    const real = getDb() as any
    const v = real[prop]
    return typeof v === 'function' ? v.bind(real) : v
  },
})

export type DB = NeonDatabase<typeof schema>
