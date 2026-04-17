// BGI Tools — Funciones de autenticación compartidas

async function bgiRequireAuth(allowedRoles = null) {
  const { data: { session } } = await bgiSupabase.auth.getSession();

  if (!session) {
    window.location.href = '/login/';
    return null;
  }

  const { data: profile } = await bgiSupabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!profile) {
    await bgiSupabase.auth.signOut();
    window.location.href = '/login/';
    return null;
  }

  if (!profile.is_active) {
    await bgiSupabase.auth.signOut();
    window.location.href = '/login/?error=inactive';
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    if (['super_admin', 'bgi_team'].includes(profile.role)) {
      window.location.href = '/admin/';
    } else {
      window.location.href = '/';
    }
    return null;
  }

  return { session, profile };
}

async function bgiSignOut() {
  await bgiSupabase.auth.signOut();
  window.location.href = '/login/';
}

async function bgiGetToken() {
  const { data: { session } } = await bgiSupabase.auth.getSession();
  return session?.access_token || null;
}
