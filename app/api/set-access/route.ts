import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const appKey = req.headers.get('x-app-key')
  if (!process.env.ERROR_REPORT_KEY || appKey !== process.env.ERROR_REPORT_KEY) {
    return NextResponse.json({ ok: false, error: 'no_auth' }, { status: 401 })
  }

  const { org_id, valid_until, plan } = await req.json().catch(() => ({}))
  if (!org_id || !valid_until) {
    return NextResponse.json({ ok: false, error: 'org_id y valid_until requeridos' }, { status: 400 })
  }

  const row: { tenant_id: string; valid_until: string; plan?: string } = { tenant_id: org_id, valid_until }
  if (plan) row.plan = plan

  const { error } = await supabaseAdmin
    .from('tenant_access')
    .upsert(row, { onConflict: 'tenant_id' })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
