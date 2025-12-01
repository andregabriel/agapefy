// Script para executar a deleção final do usuário via SQL
// Execute: node scripts/execute-delete-user.js

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vvgqqlrujmyxzzygsizc.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não configurada');
  console.log('Configure a variável de ambiente SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const userId = '25ec37c9-5e96-46b5-bb10-9cfcb16566bc';
const email = 'andre@agapepray.com';

async function deleteUser() {
  try {
    // Executar SQL diretamente via REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: `DELETE FROM auth.users WHERE id = '${userId}'::uuid;`
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erro HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Usuário deletado com sucesso!');
    console.log('Resultado:', result);
    
  } catch (error) {
    console.error('❌ Erro ao executar SQL:', error.message);
    console.log('\n📝 Execute manualmente no Supabase SQL Editor:');
    console.log(`DELETE FROM auth.users WHERE id = '${userId}'::uuid;`);
    process.exit(1);
  }
}

deleteUser();

