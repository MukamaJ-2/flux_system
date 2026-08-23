export function getRole(user) {
  return user?.role || ''
}

export function hasPermission(user, permission) {
  if (!user) return false
  const role = getRole(user)
  if (role === 'sysadmin') return true

  const permissionsByRole = {
    chair: ['create_group', 'onboard_members', 'manage_groups'],
    mobilizer: ['create_group', 'onboard_members'],
    treasury: [],
    secretary: [],
    audit: [],
    member: [],
  }

  return permissionsByRole[role]?.includes(permission)
}

export function hasAnyRole(user, ...roles) {
  if (!user) return false
  return roles.includes(getRole(user))
}

export function canAccessRoute(user, allowedRoles = []) {
  if (!user) return false
  return allowedRoles.includes(getRole(user))
}

export function canManageGroup(user, group) {
  if (!user) return false
  if (getRole(user) === 'sysadmin') return true
  if (getRole(user) === 'chair') return true

  return group?.members?.some((membership) => membership.role === 'admin' && membership.id === user.id)
}

export function getDashboardPathForRole(role) {
  switch (role) {
    case 'sysadmin':
      return '/admin'
    case 'chair':
      return '/chair'
    case 'treasury':
      return '/treasury'
    case 'secretary':
      return '/secretary'
    case 'audit':
      return '/audit'
    case 'mobilizer':
      return '/mobilizer'
    default:
      return '/'
  }
}
