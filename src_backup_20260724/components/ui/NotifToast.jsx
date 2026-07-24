import { useEffect } from 'react'
import useNotifStore from '../../store/notifStore'

function getNotifIcon(type) {
  if (!type) return { icon:'notifications', color:'var(--gold)' }
  const t = type.toLowerCase()
  if (t.includes('reservation')) return { icon:'event_available',    color:'var(--stripe)' }
  if (t.includes('order'))       return { icon:'shopping_bag',       color:'var(--gold)'   }
  if (t.includes('stock'))       return { icon:'inventory_2',        color:'var(--red)'    }
  if (t.includes('message'))     return { icon:'chat_bubble',        color:'#25D366'       }
  return { icon:'notifications', color:'var(--gold)' }
}

export default function NotifToast() {
  const toastQueue   = useNotifStore(s => s.toastQueue)
  const dismissToast = useNotifStore(s => s.dismissToast)
  console.log('[NotifToast] rendering, queue length:', toastQueue.length)

  useEffect(() => {
    if (toastQueue.length === 0) return
    const latest = toastQueue[toastQueue.length - 1]
    const timer  = setTimeout(() => dismissToast(latest._toastId), 5000)
    return () => clearTimeout(timer)
  }, [toastQueue])
  console.log('Rendering NotifToast with queue>>>>>>:', toastQueue)

  if (toastQueue.length === 0) return null

  return (
    <div style={{ position:'fixed', top:20, right:20, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
      {toastQueue.map(n => {
        const { icon, color } = getNotifIcon(n.type)
        return (
          <div key={n._toastId} style={{
            background:'var(--deep)',
            color:'var(--cream)',
            borderRadius:12,
            padding:'12px 16px',
            display:'flex',
            alignItems:'flex-start',
            gap:10,
            minWidth:280,
            maxWidth:360,
            boxShadow:'0 4px 20px rgba(0,0,0,.25)',
            animation:'slideIn .2s ease',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize:18, color, flexShrink:0, marginTop:1 }}>{icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, fontWeight:700, marginBottom:2 }}>{n.title}</div>
              <div style={{ fontSize:10, opacity:.75, lineHeight:1.4 }}>{n.body}</div>
            </div>
            <span className="material-symbols-outlined"
              style={{ fontSize:14, opacity:.5, cursor:'pointer', flexShrink:0 }}
              onClick={() => dismissToast(n._toastId)}>
              close
            </span>
          </div>
        )
      })}
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }`}</style>
    </div>
  )
}
