const protectedViews = new Set(['resources','schooladmin','teacher','gradebook','behaviour','dashboard','planner','settings','profile','achievements','admin']);

export function resolveWorkspaceView({view,authReady,hasAccess,teacherLocked,sysadmin=false,schoolAccount=true}) {
  if (!authReady) return 'loading';
  // Login must remain reachable from demo workspaces and after sign-out.
  if (view === 'login') return 'login';
  if (!hasAccess && protectedViews.has(view)) return 'login';
  if (hasAccess && !schoolAccount && ['schooladmin','teacher','gradebook','behaviour','resources'].includes(view)) return 'dashboard';
  if(hasAccess&&sysadmin&&['home','dashboard','planner','teacher','gradebook','behaviour','schooladmin'].includes(view))return 'schooladmin';
  if (hasAccess && !teacherLocked && ['teacher','gradebook','schooladmin'].includes(view)) return 'dashboard';
  if (hasAccess && teacherLocked && ['home','dashboard','planner'].includes(view)) return 'teacher';
  return view;
}
