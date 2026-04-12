import Cookies from 'js-cookie'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export const downloadSubmission = async (submissionId, fileName, role = 'student') => {
  const token = Cookies.get('accessToken')
  const url = `${BASE_URL}/${role}/submissions/${submissionId}/download`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) throw new Error('Fayl yuklab bo\'lmadi')

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = fileName || 'file'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}
