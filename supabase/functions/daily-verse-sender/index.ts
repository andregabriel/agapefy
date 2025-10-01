// @deno-types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const ZAPI_INSTANCE_NAME = Deno.env.get('ZAPI_INSTANCE_NAME') || "3E60EE9AC55FD0C647E46EB3E4757B57"
const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN') || "9F677316F38A3D2FA08EEB09"
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN') || "F3adb78efb3ba40888e8c090e6b90aea4S"
const ZAPI_BASE_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_NAME}/token/${ZAPI_TOKEN}`

// Read Supabase envs from SB_* first (Secrets in Edge), fallback to SUPABASE_*
const SB_URL = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL') || ''
const SB_SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const isTest = url.searchParams.get('test') === 'true'
    const limit = parseInt(url.searchParams.get('limit') || '0') || undefined

    // Preferir frase diária de app_settings (Home)
    const daily = await getDailyQuoteFromSettings()
    let finalMessage: string
    let verseId: string | null = null

    if (daily) {
      finalMessage = `🌅 *Bom dia! Versículo do Dia*\n\n"${daily.text}"\n\n📍 ${daily.reference}\n\n🙏 Que este versículo abençoe seu dia!\n\n_Agape - Seu companheiro espiritual_ ✨`
      verseId = daily.verse_id || null
    } else {
      const v = await getRandomVerse()
      if (!v) {
        return new Response(JSON.stringify({ error: 'Nenhum versículo encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      finalMessage = `🌅 *Bom dia! Versículo do Dia*\n\n"${v.verse_text}"\n\n📍 ${v.book} ${v.chapter}:${v.start_verse}\n\n🙏 Que este versículo abençoe seu dia!\n\n_Agape - Seu companheiro espiritual_ ✨`
      verseId = v.verse_id
    }

    // Buscar usuários ativos (opcionalmente limitar para teste)
    let users = await getActiveUsers()
    if (limit) users = users.slice(0, limit)
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum usuário encontrado', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let sentCount = 0

    for (const user of users) {
      try {
        // Idempotência: não enviar novamente no dia
        const alreadySentToday = await checkIfSentToday(user.phone_number)
        if (alreadySentToday && !isTest) continue

        if (!isTest) {
          const response = await fetch(`${ZAPI_BASE_URL}/send-text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': ZAPI_CLIENT_TOKEN
            },
            body: JSON.stringify({
              phone: user.phone_number,
              message: finalMessage
            })
          })

          if (response.ok) {
            sentCount++
            await logVerseSent(user.phone_number, verseId)
          } else {
            const txt = await response.text().catch(()=>'')
            await logVerseFailed(user.phone_number, verseId, txt)
          }
          await new Promise(resolve => setTimeout(resolve, 900))
        }
      } catch (error) {
        console.error(`Erro para ${user.phone_number}:`, error)
      }
    }

    return new Response(JSON.stringify({ message: 'Versículo enviado', sent: sentCount, total_users: users.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Erro:', error)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getRandomVerse() {
  try {
    const response = await fetch(`${SB_URL}/rest/v1/verses?select=verse_id,verse_text,book,chapter,start_verse&limit=1`, {
      headers: { 'apikey': SB_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SB_SERVICE_ROLE_KEY}` }
    })
    const verses = await response.json()
    return verses?.[0] || null
  } catch (error) {
    console.error('Erro ao buscar versículo:', error)
    return null
  }
}

async function getDailyQuoteFromSettings(): Promise<{ text: string; reference: string; verse_id?: string } | null> {
  try {
    const response = await fetch(`${SB_URL}/rest/v1/app_settings?select=key,value&key=in.(prayer_quote_text,prayer_quote_reference,prayer_quote_last_verse_id)`, {
      headers: { 'apikey': SB_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SB_SERVICE_ROLE_KEY}` }
    })
    const rows = await response.json()
    const map: Record<string, string> = {}
    for (const r of rows || []) map[r.key] = r.value
    const text = (map['prayer_quote_text'] || '').trim()
    const reference = (map['prayer_quote_reference'] || '').trim()
    const verse_id = (map['prayer_quote_last_verse_id'] || '').trim()
    if (text && reference) return { text, reference, verse_id }
    return null
  } catch {
    return null
  }
}

async function getActiveUsers() {
  try {
    const response = await fetch(`${SB_URL}/rest/v1/whatsapp_users?select=phone_number&is_active=eq.true&receives_daily_verse=eq.true`, {
      headers: { 'apikey': SB_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SB_SERVICE_ROLE_KEY}` }
    })
    return await response.json()
  } catch (error) {
    console.error('Erro ao buscar usuários:', error)
    return []
  }
}

async function checkIfSentToday(phone: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const response = await fetch(`${SB_URL}/rest/v1/daily_verse_log?select=id&user_phone=eq.${phone}&sent_at=gte.${today}T00:00:00.000Z&limit=1`, {
      headers: { 'apikey': SB_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SB_SERVICE_ROLE_KEY}` }
    })
    const logs = await response.json()
    return logs && logs.length > 0
  } catch (error) {
    console.error('Erro ao verificar envio:', error)
    return false
  }
}

async function logVerseSent(phone: string, verseId: string | null) {
  try {
    await fetch(`${SB_URL}/rest/v1/daily_verse_log`, {
      method: 'POST',
      headers: { 'apikey': SB_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SB_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_phone: phone, verse_id: verseId, delivery_status: 'sent' })
    })
  } catch (error) {
    console.error('Erro ao registrar envio:', error)
  }
}

async function logVerseFailed(phone: string, verseId: string | null, errorMsg: string) {
  try {
    await fetch(`${SB_URL}/rest/v1/daily_verse_log`, {
      method: 'POST',
      headers: { 'apikey': SB_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SB_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_phone: phone, verse_id: verseId, delivery_status: 'failed', error_msg: errorMsg?.slice(0, 500) })
    })
  } catch (error) {
    console.error('Erro ao registrar falha:', error)
  }
}