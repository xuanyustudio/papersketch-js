import { ref, onUnmounted } from 'vue'
import { io } from 'socket.io-client'

const WS_URL = (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000').replace(/^http/, 'ws')

let socketInstance = null

function getSocket() {
  if (!socketInstance) {
    socketInstance = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,   // never give up
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,       // cap at 8s between retries
    })
  }
  return socketInstance
}

/**
 * Composable for managing WebSocket connection and events.
 */
export function useWebSocket() {
  const isConnected = ref(false)
  const socket = getSocket()

  socket.on('connect', () => { isConnected.value = true })
  socket.on('disconnect', () => { isConnected.value = false })

  // Set initial state
  isConnected.value = socket.connected

  function emit(event, data) {
    socket.emit(event, data)
  }

  function on(event, handler) {
    socket.on(event, handler)
    onUnmounted(() => socket.off(event, handler))
  }

  function off(event, handler) {
    socket.off(event, handler)
  }

  return { socket, isConnected, emit, on, off }
}
