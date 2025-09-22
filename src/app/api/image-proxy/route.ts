export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'Parâmetro url obrigatório' }), { status: 400 });
    }

    // Segurança básica: permitir apenas domínios conhecidos (DALL·E Azure Blob)
    const allowedHosts = [
      'oaidalleapiprodscus.blob.core.windows.net',
      'oaidalleapiprodscus.blob.core.windows.net:443',
      'oaidalleapiprodscus.blob.core.windows.net:80',
    ];

    let hostname: string | null = null;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return new Response(JSON.stringify({ error: 'URL inválida' }), { status: 400 });
    }

    if (!allowedHosts.includes(hostname)) {
      return new Response(JSON.stringify({ error: 'Host não permitido' }), { status: 400 });
    }

    const upstream = await fetch(url, {
      // Alguns servidores exigem user-agent explícito
      headers: { 'User-Agent': 'agapefy-image-proxy' },
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'Falha ao baixar imagem', status: upstream.status, body: txt.slice(0, 500) }), { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';
    const arrayBuffer = await upstream.arrayBuffer();

    return new Response(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Erro interno' }), { status: 500 });
  }
}



