// ============================================================
//  BGI Tools — API de administración de usuarios
//  Solo accesible para super_admin y bgi_team
// ============================================================

const { createClient } = require('@supabase/supabase-js');

function getAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Verificar token del admin
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  const supabaseAdmin = getAdminClient();

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' });

  const { data: adminProfile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!adminProfile || !['super_admin', 'bgi_team'].includes(adminProfile.role)) {
    return res.status(403).json({ error: 'Sin permisos de administrador' });
  }

  const action = req.query.action;

  // ── LISTAR USUARIOS ────────────────────────────────────────
  if (req.method === 'GET' && action === 'list') {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ users: profiles });
  }

  // ── ESTADÍSTICAS DE USO ────────────────────────────────────
  if (req.method === 'GET' && action === 'usage') {
    const { data: logs, error } = await supabaseAdmin
      .from('usage_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) return res.status(500).json({ error: error.message });

    // Tokens y conteos del mes actual
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: monthLogs } = await supabaseAdmin
      .from('usage_logs')
      .select('tokens_used, tool, user_id')
      .gte('created_at', firstOfMonth);

    const tokensThisMonth = (monthLogs || []).reduce((sum, l) => sum + l.tokens_used, 0);
    const genThisMonth = (monthLogs || []).length;

    // Conteo por usuario (todas las historias)
    const allLogs = logs || [];
    const userStats = {};
    for (const l of allLogs) {
      if (!l.user_id) continue;
      if (!userStats[l.user_id]) userStats[l.user_id] = { cta: 0, recurso: 0, tokens: 0 };
      if (l.tool === 'historias_cta') userStats[l.user_id].cta++;
      else if (l.tool === 'historias_recurso') userStats[l.user_id].recurso++;
      userStats[l.user_id].tokens += l.tokens_used;
    }

    return res.status(200).json({ logs: allLogs, tokensThisMonth, genThisMonth, userStats });
  }

  // ── CREAR USUARIO ──────────────────────────────────────────
  if (req.method === 'POST' && action === 'create') {
    const { email, password, name, role, enabled_tools } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // Solo super_admin puede crear equipo BGI
    if (role === 'bgi_team' && adminProfile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Solo el Super Admin puede crear equipo BGI' });
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role }
    });

    if (createError) return res.status(400).json({ error: createError.message });

    // Actualizar perfil con datos adicionales
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        name,
        role,
        enabled_tools: enabled_tools || ['generador_historias']
      })
      .eq('id', newUser.user.id);

    if (profileError) return res.status(500).json({ error: profileError.message });

    return res.status(200).json({ success: true });
  }

  // ── ACTUALIZAR USUARIO ─────────────────────────────────────
  if (req.method === 'PUT' && action === 'update') {
    const { userId, name, role, enabled_tools, is_active, password } = req.body;

    if (!userId) return res.status(400).json({ error: 'Falta userId' });

    // Solo super_admin puede cambiar roles
    if (role !== undefined && adminProfile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Solo el Super Admin puede cambiar roles' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (enabled_tools !== undefined) updates.enabled_tools = enabled_tools;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (profileError) return res.status(500).json({ error: profileError.message });
    }

    // Cambiar contraseña si se proporcionó
    if (password) {
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (pwError) return res.status(500).json({ error: pwError.message });
    }

    return res.status(200).json({ success: true });
  }

  // ── ELIMINAR USUARIO ───────────────────────────────────────
  if (req.method === 'DELETE' && action === 'delete') {
    if (adminProfile.role !== 'super_admin') {
      return res.status(403).json({ error: 'Solo el Super Admin puede eliminar usuarios' });
    }

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Falta userId' });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Acción no válida' });
};
