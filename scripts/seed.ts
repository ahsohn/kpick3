import 'dotenv/config'
import { db } from '../lib/db'
import { users } from '../lib/db/schema'
import { hashPin } from '../lib/auth/pin'
import { eq } from 'drizzle-orm'

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const pin = process.env.ADMIN_PIN?.trim()
  if (!email) throw new Error('ADMIN_EMAIL is not set')
  if (!pin) throw new Error('ADMIN_PIN is not set')

  const pinHash = hashPin(pin)
  const existing = await db.select().from(users).where(eq(users.email, email))
  if (existing.length > 0) {
    await db.update(users).set({ isAdmin: true, pinHash }).where(eq(users.email, email))
    console.log(`Updated existing user ${email} as admin (PIN reset).`)
  } else {
    await db.insert(users).values({
      email,
      displayName: email.split('@')[0],
      isAdmin: true,
      pinHash,
    })
    console.log(`Created admin user ${email}.`)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
