export const IT_ROLES = [
  'Frontend разработчик',
  'Backend разработчик',
  'Fullstack разработчик',
  'QA инженер',
  'DevOps инженер',
  'Product Manager',
  'UI/UX дизайнер',
  'Team Lead',
] as const

export type ITRole = (typeof IT_ROLES)[number]

/** Default from DB trigger when role was not chosen explicitly (e.g. Google OAuth). */
export const DEFAULT_UNSELECTED_ROLE = 'Team Member'

export function isRoleSelected(role: string | null | undefined): boolean {
  return Boolean(role && role.trim() && role !== DEFAULT_UNSELECTED_ROLE)
}
