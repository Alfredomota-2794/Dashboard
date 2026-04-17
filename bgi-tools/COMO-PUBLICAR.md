# Cómo publicar BGI Tools en bgitools.com

## Paso 1 — Crear cuenta en Vercel
1. Ve a vercel.com y crea una cuenta gratuita (puedes entrar con Google)

## Paso 2 — Subir el proyecto
1. En Vercel, haz clic en "Add New Project"
2. Selecciona "Upload" y sube toda la carpeta `bgi-tools/`
3. O conecta con GitHub si tienes el proyecto ahí

## Paso 3 — Agregar tu API Key de Anthropic
1. En tu proyecto de Vercel, ve a "Settings" → "Environment Variables"
2. Agrega:
   - Name:  ANTHROPIC_API_KEY
   - Value: sk-ant-... (tu API key de Anthropic)
3. Haz clic en "Save"
4. Haz un "Redeploy" para que aplique la variable

## Paso 4 — Conectar tu dominio bgitools.com
1. En Vercel, ve a "Settings" → "Domains"
2. Agrega: bgitools.com
3. Vercel te dará instrucciones para apuntar tu dominio desde GoDaddy
4. En GoDaddy, cambia los DNS a los que indica Vercel (tarda 24-48 hrs)

## Listo — Tu app estará en:
- Hub principal:         bgitools.com
- Generador historias:   bgitools.com/generador-historias/

## Cómo obtener tu API Key de Anthropic
1. Ve a console.anthropic.com
2. Crea una cuenta
3. Ve a "API Keys" y genera una nueva key
4. Copia esa key y pégala en Vercel (Paso 3)
