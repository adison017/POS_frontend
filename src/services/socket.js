import { io } from 'socket.io-client'

const getBackendBase = () => {
  const raw = import.meta.env.VITE_BACKEND_URL?.trim()
  if (raw) {
    const hasProtocol = /^https?:\/\//i.test(raw)
    return hasProtocol ? raw : `http://${raw}`
  }
  // default dev server
  return 'http://localhost:4000'
}

let socket

export const connectSocket = () => {
  if (!socket) {
    socket = io(getBackendBase(), { withCredentials: true })
  }
  return socket
}

export const getSocket = () => socket

export default { connectSocket, getSocket }

