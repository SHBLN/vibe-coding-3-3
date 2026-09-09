import type { Tables } from './database.types'
import { supabase } from './supabase'

export type ProfileRow = Tables<'profiles'>

export type AssigneeProfile = {
  id: string
  displayName: string
  role: string
}

function mapProfile(row: ProfileRow): AssigneeProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    role: row.role,
  }
}

export function getProfileInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export async function listProfiles(): Promise<AssigneeProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, created_at')
    .order('display_name', { ascending: true })
    .returns<ProfileRow[]>()

  if (error) throw new Error(error.message)

  return (data ?? []).map(mapProfile)
}

export function getUniqueRoles(profiles: AssigneeProfile[]): string[] {
  const roles = new Set(profiles.map((profile) => profile.role).filter(Boolean))
  return [...roles].sort((a, b) => a.localeCompare(b, 'ru'))
}

export function filterProfiles(
  profiles: AssigneeProfile[],
  searchTerm: string,
  selectedRole: string | null,
): AssigneeProfile[] {
  const normalizedSearch = searchTerm.trim().toLowerCase()

  return profiles.filter((profile) => {
    const matchesSearch =
      !normalizedSearch || profile.displayName.toLowerCase().includes(normalizedSearch)
    const matchesRole = !selectedRole || profile.role === selectedRole
    return matchesSearch && matchesRole
  })
}
