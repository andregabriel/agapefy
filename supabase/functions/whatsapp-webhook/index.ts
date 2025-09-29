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
    const body = await req.json()
    console.log('Webhook recebido:', JSON.stringify(body, null, 2))

    if (!body.phone || !body.message || body.fromMe) {
      return new Response('OK', { headers: corsHeaders })
    }

    const userPhone = body.phone.replace(/\D/g, '')
    const messageContent = body.message.conversation || body.message.text || ''
    const userName = body.senderName || 'Irmão(ã)'

    // Registrar usuário no Supabase
    await registerUser(userPhone, userName)

    // Gerar resposta inteligente
    const response = await generateResponse(messageContent, userName, userPhone)

    // Salvar conversa
    await saveConversation(userPhone, messageContent, response)

    // Enviar resposta via Z-API
    await sendWhatsAppMessage(userPhone, response)

    return new Response('OK', { headers: corsHeaders })

  } catch (error) {
    console.error('Erro no webhook:', error)
    return new Response('Error', { status: 500, headers: corsHeaders })
  }
})

async function registerUser(phone: string, name: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    await fetch(`${supabaseUrl}/rest/v1/whatsapp_users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        phone_number: phone,
        name: name,
        updated_at: new Date().toISOString()
      })
    })
  } catch (error) {
    console.error('Erro ao registrar usuário:', error)
  }
}

async function generateResponse(message: string, userName: string, userPhone: string): Promise<string> {
  try {
    // Detectar intenção
    const intention = detectIntention(message)
    
    // Buscar histórico de conversas
    const history = await getConversationHistory(userPhone)
    
    let systemPrompt = ''
    let responsePrefix = ''

    switch (intention) {
      case 'prayer_request':
        systemPrompt = `Você é Agape, um assistente espiritual cristão. O usuário precisa de oração. Crie uma oração personalizada e reconfortante para a situação dele. Use linguagem acolhedora.`
        responsePrefix = '🙏 '
        break
        
      case 'bible_question':
        systemPrompt = `Você é Agape, especialista da Bíblia. Responda perguntas bíblicas com conhecimento teológico e referências bíblicas. Seja didático e acessível.`
        responsePrefix = '📖 '
        break
        
      case 'daily_verse':
        return await getDailyVerse()
        
      case 'spiritual_guidance':
        systemPrompt = `Você é Agape, conselheiro espiritual cristão. Ofereça orientação baseada nos ensinamentos bíblicos com empatia e sabedoria.`
        responsePrefix = '✨ '
        break
        
      default:
        systemPrompt = `Você é Agape, companheiro espiritual cristão inteligente e carinhoso. Responda naturalmente com empatia e sabedoria cristã.`
        responsePrefix = '💙 '
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}

IMPORTANTE:
- Seu nome é Agape
- Seja natural, empático e inteligente
- Use emojis apropriados mas sem exagero
- Mantenha respostas entre 100-400 caracteres para WhatsApp
- Seja genuinamente útil e acolhedor

${history ? `Contexto da conversa:\n${history}` : ''}

Nome do usuário: ${userName}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 300,
        temperature: 0.8,
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error('Erro na API OpenAI')
    }

    const data = await openaiResponse.json()
    const response = data.choices[0]?.message?.content || 'Olá! Como posso te ajudar hoje? 😊'

    return `${responsePrefix}${response}`

  } catch (error) {
    console.error('Erro ao gerar resposta:', error)
    return `🤗 Olá ${userName}! Sou o Agape, seu companheiro espiritual. Como posso te ajudar hoje? 😊`
  }
}

function detectIntention(message: string): string {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes('oração') || lowerMessage.includes('ore') || lowerMessage.includes('dificuldade') || 
      lowerMessage.includes('problema') || lowerMessage.includes('triste') || lowerMessage.includes('ansioso')) {
    return 'prayer_request'
  }
  
  if (lowerMessage.includes('bíblia') || lowerMessage.includes('versículo') || lowerMessage.includes('jesus') ||
      lowerMessage.includes('deus') || lowerMessage.includes('parábola')) {
    return 'bible_question'
  }
  
  if (lowerMessage.includes('versículo do dia') || lowerMessage.includes('/versiculo')) {
    return 'daily_verse'
  }
  
  if (lowerMessage.includes('conselho') || lowerMessage.includes('orientação') || lowerMessage.includes('direção')) {
    return 'spiritual_guidance'
  }
  
  return 'general_conversation'
}

async function getConversationHistory(userPhone: string): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    const response = await fetch(`${supabaseUrl}/rest/v1/whatsapp_conversations?user_phone=eq.${userPhone}&order=created_at.desc&limit=5`, {
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })
    
    const conversations = await response.json()
    
    if (conversations && conversations.length > 0) {
      return conversations.reverse().map((conv: any) => 
        `Usuário: ${conv.message_content}\nAgape: ${conv.response_content}`
      ).join('\n\n')
    }
    
    return ''
  } catch (error) {
    console.error('Erro ao buscar histórico:', error)
    return ''
  }
}

async function getDailyVerse(): Promise<string> {
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
    
    if (verses && verses.length > 0) {
      const verse = verses[0]
      return `📖 *Versículo do Dia*\n\n"${verse.verse_text}"\n\n📍 ${verse.book} ${verse.chapter}:${verse.start_verse}\n\n🙏 Que este versículo abençoe seu dia!`
    }
  } catch (error) {
    console.error('Erro ao buscar versículo:', error)
  }
  
  return "📖 *Versículo do Dia*\n\n\"Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz e não de mal, para vos dar o fim que esperais.\"\n\n📍 Jeremias 29:11\n\n🙏 Que este versículo abençoe seu dia!"
}

async function saveConversation(userPhone: string, message: string, response: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    await fetch(`${supabaseUrl}/rest/v1/whatsapp_conversations`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey!,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_phone: userPhone,
        conversation_type: 'intelligent_chat',
        message_content: message,
        response_content: response,
        message_type: 'text'
      })
    })
  } catch (error) {
    console.error('Erro ao salvar conversa:', error)
  }
}

async function sendWhatsAppMessage(phone: string, message: string) {
  try {
    const response = await fetch(`${ZAPI_BASE_URL}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN
      },
      body: JSON.stringify({
        phone: phone,
        message: message
      })
    })

    if (response.ok) {
      console.log(`Mensagem enviada para ${phone}`)
    } else {
      console.error('Erro ao enviar mensagem:', await response.text())
    }
  } catch (error) {
    console.error('Erro no envio:', error)
  }
}