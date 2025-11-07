// Storage service backed by the Express API
import apiClient from './apiClient'

export async function uploadToSupabaseStorage(file, folder = 'menu') {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)

    const { data } = await apiClient.post('/storage/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return data
  } catch (error) {
    console.error('Storage upload failed:', error)
    throw new Error(error.message || 'Upload failed')
  }
}

export async function deleteFromSupabaseStorage(filePath) {
  try {
    await apiClient.post('/storage/delete', { path: filePath })
    return true
  } catch (error) {
    console.error('Storage delete failed:', error)
    throw new Error(error.message || 'Delete failed')
  }
}

export default { uploadToSupabaseStorage, deleteFromSupabaseStorage }