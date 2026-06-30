import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNotifications, markRead, markAllRead } from '../api/notifications'

export function useNotifications() {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: getNotifications,
    refetchInterval: 30_000, // poll every 30s
  })

  const unreadCount = query.data?.filter(n => !n.is_read).length ?? 0

  const markOne = useMutation({
    mutationFn: markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return {
    notifications: query.data ?? [],
    unreadCount,
    isLoading: query.isLoading,
    markOne: markOne.mutate,
    markAll: markAll.mutate,
  }
}
