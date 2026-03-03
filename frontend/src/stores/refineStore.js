import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api/index.js'

export const useRefineStore = defineStore('refine', () => {
  const isRefining = ref(false)
  const originalImageUrl = ref(null)
  const refinedImageUrl = ref(null)
  const suggestions = ref('')
  const error = ref(null)
  const noChanges = ref(false)
  const processingTimeMs = ref(0)

  async function refine({ file, editPrompt, aspectRatio, taskName }) {
    if (isRefining.value) return

    isRefining.value = true
    error.value = null
    refinedImageUrl.value = null
    suggestions.value = ''
    noChanges.value = false

    const formData = new FormData()
    formData.append('image', file)
    formData.append('editPrompt', editPrompt)
    formData.append('aspectRatio', aspectRatio || '16:9')
    formData.append('taskName', taskName || 'diagram')

    try {
      const res = await api.refineImage(formData)
      refinedImageUrl.value = res.data.imageBase64
      suggestions.value = res.data.suggestions || ''
      noChanges.value = res.data.noChanges || false
      processingTimeMs.value = res.data.processingTimeMs || 0
    } catch (err) {
      error.value = err.message
    } finally {
      isRefining.value = false
    }
  }

  function setOriginalImage(dataUrl) {
    originalImageUrl.value = dataUrl
  }

  function reset() {
    isRefining.value = false
    originalImageUrl.value = null
    refinedImageUrl.value = null
    suggestions.value = ''
    error.value = null
    noChanges.value = false
    processingTimeMs.value = 0
  }

  return {
    isRefining, originalImageUrl, refinedImageUrl,
    suggestions, error, noChanges, processingTimeMs,
    refine, setOriginalImage, reset,
  }
})
