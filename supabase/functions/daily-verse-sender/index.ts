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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Iniciando envio de versículo diário...')

    // Preferir frase diária de app_settings (usada na Home) para manter consistência
    const daily = await getDailyQuoteFromSettings()
    const verseMessage = daily
      ? `🌅 *Bom dia! Versículo do Dia*\n\n"${daily.text}"\n\n📍 ${daily.reference}\n\n🙏 Que este versículo abençoe seu dia!\n\n_Agape - Seu companheiro espiritual_ ✨`
      : (() => {
          // Fallback: buscar versículo aleatório
          return ' ' // placeholder substituído logo abaixo
        })()

    let finalMessage = verseMessage
    if (!daily) {
      const v = await getRandomVerse()
      if (!v) {
        return new Response(JSON.stringify({ error: 'Nenhum versículo encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      finalMessage = `🌅 *Bom dia! Versículo do Dia*\n\n"${v.verse_text}"\n\n📍 ${v.book} ${v.chapter}:${v.start_verse}\n\n🙏 Que este versículo abençoe seu dia!\n\n_Agape - Seu companheiro espiritual_ ✨`
    }

    // Buscar usuários ativos
    const users = await getActiveUsers()
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: 'Nenhum usuário encontrado', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let sentCount = 0

    for (const user of users) {
      try {
        // Verificar se já enviou hoje
        const alreadySentToday = await checkIfSentToday(user.phone_number)
        if (alreadySentToday) continue

        // Enviar mensagem
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
          await logVerseSent(user.phone_number, verse.verse_id)
        }

        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Erro para ${user.phone_number}:`, error)
      }
    }

    return new Response(JSON.stringify({ 
      message: 'Versículo enviado',
      sent: sentCount,
      total_users: users.length
    }), {
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    const response = await fetch(`${supabaseUrl}/rest/v1/verses?limit=1`, {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })
    
    const verses = await response.json()
    return verses?.[0] || null
  } catch (error) {
    console.error('Erro ao buscar versículo:', error)
    return null
  }
}

async function getDailyQuoteFromSettings(): Promise<{ text: string; reference: string } | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const response = await fetch(`${supabaseUrl}/rest/v1/app_settings?select=key,value&key=in.(prayer_quote_text,prayer_quote_reference)`, {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })
    const rows = await response.json()
    const map: Record<string, string> = {}
    for (const r of rows || []) map[r.key] = r.value
    const text = (map['prayer_quote_text'] || '').trim()
    const reference = (map['prayer_quote_reference'] || '').trim()
    if (text && reference) return { text, reference }
    return null
  } catch {
    return null
  }
}

async function getActiveUsers() {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    const response = await fetch(`${supabaseUrl}/rest/v1/whatsapp_users?is_active=eq.true&receives_daily_verse=eq.true`, {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`
      }
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    const response = await fetch(`${supabaseUrl}/rest/v1/daily_verse_log?user_phone=eq.${phone}&sent_at=gte.${today}T00:00:00.000Z&limit=1`, {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })
    
    const logs = await response.json()
    return logs && logs.length > 0
  } catch (error) {
    console.error('Erro ao verificar envio:', error)
    return false
  }
}

async function logVerseSent(phone: string, verseId: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    await fetch(`${supabaseUrl}/rest/v1/daily_verse_log`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_phone: phone,
        verse_id: verseId,
        delivery_status: 'sent'
      })
    })
  } catch (error) {
    console.error('Erro ao registrar envio:', error)
  }
}