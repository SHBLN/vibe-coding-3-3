import { BoardLimitError } from './boards'
import { supabase } from './supabase'

function mapTeamMemberError(rawMessage: string): Error {
  const message = rawMessage.trim()

  if (message.includes('billing_subscription_required')) {
    const text =
      message.split(':').slice(1).join(':').trim() ||
      'Для добавления участников нужна активная подписка.'
    return new BoardLimitError(text, 'subscribe')
  }

  if (message.includes('billing_subscription_inactive')) {
    const text =
      message.split(':').slice(1).join(':').trim() ||
      'Подписка неактивна. Обновите оплату в разделе «Биллинг».'
    return new BoardLimitError(text, 'subscribe')
  }

  if (message.includes('team_member_limit')) {
    const text =
      message.split(':').slice(1).join(':').trim() ||
      'Достигнут лимит участников для вашего тарифа.'
    return new BoardLimitError(text, 'upgrade')
  }

  return new Error(message || 'Не удалось обновить участников доски.')
}

export async function fetchBoardMemberIds(boardId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('board_members')
    .select('profile_id')
    .eq('board_id', boardId)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.profile_id)
}

export async function fetchOwnerDistinctTeamMemberIds(): Promise<string[]> {
  const { data: boards, error: boardsError } = await supabase.from('boards').select('id')

  if (boardsError) throw new Error(boardsError.message)
  if (!boards || boards.length === 0) return []

  const boardIds = boards.map((board) => board.id)

  const { data, error } = await supabase
    .from('board_members')
    .select('profile_id')
    .in('board_id', boardIds)

  if (error) throw new Error(error.message)

  return [...new Set((data ?? []).map((row) => row.profile_id))]
}

export async function saveBoardMembers(boardId: string, profileIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(profileIds)]

  const { data: existingRows, error: existingError } = await supabase
    .from('board_members')
    .select('profile_id')
    .eq('board_id', boardId)

  if (existingError) throw mapTeamMemberError(existingError.message)

  const existingIds = new Set((existingRows ?? []).map((row) => row.profile_id))
  const targetIds = new Set(uniqueIds)

  const toRemove = [...existingIds].filter((id) => !targetIds.has(id))
  const toAdd = [...targetIds].filter((id) => !existingIds.has(id))

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('board_members')
      .delete()
      .eq('board_id', boardId)
      .in('profile_id', toRemove)

    if (deleteError) throw mapTeamMemberError(deleteError.message)
  }

  if (toAdd.length === 0) return

  const { error: insertError } = await supabase.from('board_members').insert(
    toAdd.map((profileId) => ({
      board_id: boardId,
      profile_id: profileId,
    })),
  )

  if (insertError) throw mapTeamMemberError(insertError.message)
}
