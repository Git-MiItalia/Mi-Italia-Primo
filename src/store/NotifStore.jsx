import { create } from 'zustand'

const useNotifStore = create((set) => ({
  notifications:  [],
  unreadCount:    0,
  toastQueue:     [],

  addNotification: (n) => set(state => {
    if (state.notifications.some(x => x.id === n.id)) return state
    return {
      notifications: [n, ...state.notifications],
      unreadCount:   state.unreadCount + 1,
      toastQueue:    [...state.toastQueue, { ...n, _toastId: Date.now() }],
    }
  }),

  setNotifications: (notifications, unreadCount) => set({ notifications, unreadCount }),

  markRead: (id) => set(state => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n),
    unreadCount:   Math.max(0, state.unreadCount - 1),
  })),

  markAllRead: () => set(state => ({
    notifications: state.notifications.map(n => ({ ...n, read_at: new Date().toISOString() })),
    unreadCount:   0,
  })),

  dismissToast: (toastId) => set(state => ({
    toastQueue: state.toastQueue.filter(t => t._toastId !== toastId),
  })),
}))

export default useNotifStore