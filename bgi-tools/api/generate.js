// ============================================================
//  BGI Tools — Función Serverless (Vercel)
//  Llama a Claude Haiku para generar historias de Instagram
//
//  Variables de entorno requeridas en Vercel:
//    ANTHROPIC_API_KEY     = API key de Anthropic
//    SUPABASE_URL          = URL del proyecto Supabase
//    SUPABASE_SERVICE_KEY  = Service role key de Supabase
// ============================================================

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key no configurada.' });
  }

  // ── Verificar autenticación ────────────────────────────
  let userId = null;
  let userEmail = null;

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { data: { user } } = await supabaseAdmin.auth.getUser(token);

      if (user) {
        userId = user.id;
        userEmail = user.email;

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('is_active, enabled_tools')
          .eq('id', user.id)
          .single();

        if (profile && !profile.is_active) {
          return res.status(403).json({ error: 'Tu cuenta no está activa. Contacta a BGI.' });
        }

        if (profile?.enabled_tools && !profile.enabled_tools.includes('generador_historias')) {
          return res.status(403).json({ error: 'No tienes acceso a esta herramienta.' });
        }
      }
    } catch (e) {
      console.error('Auth check error:', e);
    }
  }

  const { profile, type, angle } = req.body;

  if (!profile || !type) {
    return res.status(400).json({ error: 'Faltan datos del perfil o tipo de historia.' });
  }

  // ── Sistema de instrucciones para Claude ─────────────────
  const systemPrompt = `Eres un experto en marketing digital especializado en historias de Instagram para infoproductores latinoamericanos.

CONTEXTO CLAVE — LEE CON ATENCIÓN:
El alumno vende una academia digital con módulos grabados. NO es coaching ni acompañamiento 1 a 1.
Estas historias son para VALIDAR y generar leads por DM — NO son para vender directamente.
La venta ocurre después, en la conversación por DM.
Adapta SIEMPRE el lenguaje al nicho específico. Nunca uses términos genéricos.

REGLAS ABSOLUTAS DE FORMATO:
- Texto plano únicamente. Sin asteriscos, markdown, etiquetas ni títulos.
- 3 bloques separados por línea en blanco. Sin numeración.
- Lenguaje conversacional, primera persona, español latinoamericano.
- Tono directo, auténtico, cercano. Nunca sonar a vendedor agresivo.

═══════════════════════════════
TIPO 1 — CTA DIRECTO (1 historia)
═══════════════════════════════
PROPÓSITO: Generar intriga y deseo. Que la persona quiera saber más y responda "YO".
PROHIBIDO: Mencionar módulos, clases, precios, formato de la academia, ni describir la oferta.
PERMITIDO: Mencionar vagamente la transformación o lo que aprenderían — nada más.

BLOQUE 1 — HOOK (elige UNO de estos ángulos según el ángulo creativo solicitado):
• "Estoy buscando": "Estoy buscando a [número] [nicho] que quieran [resultado concreto]."
• "Grupo de prueba": "Estoy buscando [número] [nicho] para formar un grupo de prueba."
• "Oportunidad única": "OPORTUNIDAD: Mi meta de [este mes] es ayudar a [número] [nicho] a [resultado]."
• "Resultado específico": "Descubrimos una forma de [resultado] que [diferenciador breve]."
• "Observación personal": Frase sobre algo que observas en el nicho que genera curiosidad.
• "Sorpréndeme": Elige el ángulo que más impacto genere para este nicho.

BLOQUE 2 — BAJADA (genera deseo sin describir la oferta):
Máximo 2-3 líneas. Habla de la transformación o de lo que aprenderían en términos generales.
Puedes agregar escasez natural: "ya llevamos [número] 😅" o "solo [número] lugares."
NUNCA menciones: módulos, clases en vivo, grabaciones, precio, formato de academia.
Ejemplo correcto: "La idea es que aprendas a [resultado] usando [método breve]."
Ejemplo incorrecto: "Tendrás 5 módulos y clases en vivo cada semana."

BLOQUE 3 — CTA (SIEMPRE con elemento de curiosidad, nunca solo "págame"):
Usa variantes como:
- Responde "YO" y te cuento cómo funciona 👇
- Responde "YO" y veamos si entras al grupo de prueba
- Responde "YO" y te muestro cómo funciona 👇
- Responde "YO" y hablemos

Máximo total: 55 palabras.

═══════════════════════════════
TIPO 2 — RECURSO DE VALOR (2 historias)
═══════════════════════════════
PROPÓSITO: Entregar un recurso gratuito para generar leads. JAMÁS mencionar la academia ni la oferta.

HISTORIA 1 — ELEVAR VALOR PERCIBIDO DEL RECURSO (máximo 45 palabras):
Esta historia NO ofrece el recurso aún. Solo genera MUCHA curiosidad sobre él.
Usa una de estas estructuras:
• Historia de cliente/alumno: "A [un cliente/alumno] le [hice/enseñé] [algo específico]. [Su reacción o resultado impactante]. [Frase que deja con ganas de más]."
• Historia personal: "Hace un tiempo [me contrataron/fui invitado/creé algo] para [contexto]. [Resultado sorprendente]. [Cliffhanger]."
• Observación del nicho: "He estado viendo algo muy común en [nicho]. [Problema específico que todos tienen]. [Patrón o causa raíz que sorprende]."

Los 3 bloques de la Historia 1:
- Bloque 1: Contexto de la historia (1-2 frases que enganchan)
- Bloque 2: El resultado o hallazgo impactante (1 frase)
- Bloque 3: Frase de suspenso corta: "Por eso lo grabé." / "Así que lo documenté." / "Entonces creé algo."

HISTORIA 2 — OFRECER EL RECURSO (máximo 25 palabras, extremadamente breve):
La curiosidad ya está generada. Solo nombra el recurso y pide la palabra clave.
- Bloque 1: "[Grabé/Preparé/Hice] un [tipo de recurso] [descripción muy breve de qué cubre]."
- Bloque 2: El CTA SIEMPRE debe incluir la palabra clave Y explicar qué recibirán al responder.
  Varía la frase de entrega entre estas opciones (elige una diferente cada vez):
  "Responde '[PALABRA_CLAVE]' y te lo envío 👇"
  "Responde '[PALABRA_CLAVE]' y te la comparto por DM 👇"
  "Responde '[PALABRA_CLAVE]' y te lo mando ahora 👇"
  "Responde '[PALABRA_CLAVE]' y te la paso por DM 👇"
  "Responde '[PALABRA_CLAVE]' y te lo regalo 👇"
  "Responde '[PALABRA_CLAVE]' y te lo mando a tu DM 👇"
NUNCA menciones la academia ni la oferta en esta historia.

Separa las dos historias con exactamente: ---HISTORIA2---

DEVUELVE ÚNICAMENTE el texto. Sin explicaciones, títulos, etiquetas ni comentarios.`;

  // ── Prompt del usuario ────────────────────────────────────
  const typeLabel = type === 'cta_directo' ? 'CTA DIRECTO' : 'RECURSO DE VALOR';
  const angleText = angle && angle !== 'Sorpréndeme' ? `Ángulo creativo: ${angle}` : 'Elige el ángulo que mejor funcione para este nicho.';

  const userPrompt = `Genera una historia de Instagram de tipo: ${typeLabel}
${angleText}

Perfil del alumno:
- A quién ayuda (nicho corto): ${profile.nicho}
- Audiencia completa: ${profile.audiencia}
- Tema del curso: ${profile.tema}
- Transformación que logra el alumno: ${profile.transformacion}
- Resultado específico y tangible: ${profile.resultado}
- Beneficio clave del método: ${profile.beneficio}
${profile.nombre_curso ? `- Nombre de la academia: ${profile.nombre_curso}` : ''}
${type === 'recurso_valor' ? `- Recurso gratuito que ofrece: ${profile.recurso}
- Palabra clave para responder: ${profile.palabra_clave}` : ''}

Recuerda: máximo 60 palabras, 3 bloques, lenguaje natural y específico para ${profile.nicho}.`;

  // ── Llamada a la API de Anthropic ────────────────────────
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(500).json({ error: 'Error al conectar con la IA. Intenta de nuevo.' });
    }

    const data = await response.json();
    const generatedText = data.content?.[0]?.text || '';
    const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

    // ── Registrar uso en Supabase ─────────────────────────
    if (userId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
      try {
        const supabaseAdmin = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const storyType = type === 'cta_directo' ? 'historias_cta' : 'historias_recurso';
        await supabaseAdmin.from('usage_logs').insert({
          user_id: userId,
          user_email: userEmail,
          tool: storyType,
          tokens_used: tokensUsed
        });

        await supabaseAdmin.rpc('increment_credits', {
          p_user_id: userId,
          amount: tokensUsed
        });
      } catch (e) {
        console.error('Usage log error:', e);
      }
    }

    return res.status(200).json({ text: generatedText });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Error inesperado. Intenta de nuevo en unos segundos.' });
  }
};
