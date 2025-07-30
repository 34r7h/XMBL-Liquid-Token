import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import apiService from '../../services/apiService'

// Mock fetch globally
global.fetch = vi.fn()

describe('apiService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset any stored auth tokens
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Configuration', () => {
    it('should have correct base URL configuration', () => {
      expect(apiService.baseURL).toBe(process.env.VITE_API_URL || 'http://localhost:3000/api')
    })

    it('should set default timeout', () => {
      expect(apiService.timeout).toBe(10000) // 10 seconds
    })

    it('should include default headers', () => {
      expect(apiService.defaultHeaders).toEqual({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      })
    })
  })

  describe('Authentication', () => {
    it('should set authorization header when token is provided', () => {
      const token = 'test-jwt-token'
      apiService.setAuthToken(token)

      expect(localStorage.getItem('authToken')).toBe(token)
      expect(apiService.getAuthHeader()).toEqual({
        'Authorization': `Bearer ${token}`
      })
    })

    it('should clear authorization when token is removed', () => {
      apiService.setAuthToken('test-token')
      apiService.clearAuthToken()

      expect(localStorage.getItem('authToken')).toBeNull()
      expect(apiService.getAuthHeader()).toEqual({})
    })

    it('should automatically include auth header in requests', async () => {
      const token = 'test-jwt-token'
      apiService.setAuthToken(token)

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      } as Response)

      await apiService.get('/test-endpoint')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${token}`
          })
        })
      )
    })

    it('should handle token refresh on 401 responses', async () => {
      const refreshToken = 'refresh-token'
      const newToken = 'new-access-token'

      localStorage.setItem('refreshToken', refreshToken)

      // First request fails with 401
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' })
        } as Response)
        // Token refresh succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ accessToken: newToken })
        } as Response)
        // Retry request succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' })
        } as Response)

      const result = await apiService.get('/protected-endpoint')

      expect(fetch).toHaveBeenCalledTimes(3)
      expect(result.data).toBe('success')
      expect(localStorage.getItem('authToken')).toBe(newToken)
    })

    it('should logout user when refresh token is invalid', async () => {
      const refreshToken = 'invalid-refresh-token'
      localStorage.setItem('refreshToken', refreshToken)

      // Initial request fails with 401
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        } as Response)
        // Refresh fails
        .mockResolvedValueOnce({
          ok: false,
          status: 401
        } as Response)

      await expect(apiService.get('/protected-endpoint')).rejects.toThrow('Authentication failed')
      expect(localStorage.getItem('authToken')).toBeNull()
      expect(localStorage.getItem('refreshToken')).toBeNull()
    })
  })

  describe('HTTP Methods', () => {
    it('should make GET requests correctly', async () => {
      const mockResponse = { data: 'test-data' }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response)

      const result = await apiService.get('/test-endpoint')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object)
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should make POST requests with data', async () => {
      const postData = { name: 'test', value: 123 }
      const mockResponse = { id: 1, ...postData }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse
      } as Response)

      const result = await apiService.post('/test-endpoint', postData)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Object),
          body: JSON.stringify(postData)
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should make PUT requests correctly', async () => {
      const putData = { id: 1, name: 'updated' }
      const mockResponse = { ...putData, updatedAt: '2024-01-15' }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response)

      const result = await apiService.put('/test-endpoint/1', putData)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(putData)
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should make DELETE requests correctly', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 204
      } as Response)

      await apiService.delete('/test-endpoint/1')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint/1'),
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })

    it('should make PATCH requests correctly', async () => {
      const patchData = { status: 'active' }
      const mockResponse = { id: 1, ...patchData }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response)

      const result = await apiService.patch('/test-endpoint/1', patchData)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test-endpoint/1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(patchData)
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      await expect(apiService.get('/test-endpoint')).rejects.toThrow('Network error')
    })

    it('should handle HTTP error responses', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Resource not found' })
      } as Response)

      await expect(apiService.get('/nonexistent')).rejects.toThrow('HTTP 404: Not Found')
    })

    it('should handle server errors with details', async () => {
      const errorResponse = {
        error: 'Validation failed',
        details: ['Field "name" is required', 'Field "email" must be valid']
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => errorResponse
      } as Response)

      try {
        await apiService.post('/test-endpoint', {})
      } catch (error: any) {
        expect(error.status).toBe(400)
        expect(error.data).toEqual(errorResponse)
      }
    })

    it('should handle timeout errors', async () => {
      vi.useFakeTimers()

      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ data: 'slow response' })
        }), 15000) // 15 seconds, longer than timeout
      })

      vi.mocked(fetch).mockReturnValueOnce(slowPromise as Promise<Response>)

      const requestPromise = apiService.get('/slow-endpoint')

      vi.advanceTimersByTime(10000) // Advance to timeout

      await expect(requestPromise).rejects.toThrow('Request timeout')

      vi.useRealTimers()
    })

    it('should retry failed requests with exponential backoff', async () => {
      // First two requests fail, third succeeds
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' })
        } as Response)

      const result = await apiService.get('/unreliable-endpoint', { retry: true, maxRetries: 3 })

      expect(fetch).toHaveBeenCalledTimes(3)
      expect(result.data).toBe('success')
    })

    it('should not retry on client errors (4xx)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' })
      } as Response)

      await expect(apiService.get('/bad-endpoint', { retry: true })).rejects.toThrow()
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('Request/Response Interceptors', () => {
    it('should allow request interceptors', async () => {
      const requestInterceptor = vi.fn((config) => {
        config.headers['X-Custom-Header'] = 'test-value'
        return config
      })

      apiService.addRequestInterceptor(requestInterceptor)

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      } as Response)

      await apiService.get('/test-endpoint')

      expect(requestInterceptor).toHaveBeenCalled()
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'test-value'
          })
        })
      )
    })

    it('should allow response interceptors', async () => {
      const responseInterceptor = vi.fn((response) => {
        response.metadata = { intercepted: true }
        return response
      })

      apiService.addResponseInterceptor(responseInterceptor)

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' })
      } as Response)

      const result = await apiService.get('/test-endpoint')

      expect(responseInterceptor).toHaveBeenCalled()
      expect(result.metadata).toEqual({ intercepted: true })
    })

    it('should handle interceptor errors', async () => {
      const errorInterceptor = vi.fn(() => {
        throw new Error('Interceptor error')
      })

      apiService.addRequestInterceptor(errorInterceptor)

      await expect(apiService.get('/test-endpoint')).rejects.toThrow('Interceptor error')
    })
  })

  describe('Caching', () => {
    it('should cache GET requests when enabled', async () => {
      const cacheKey = '/test-endpoint'
      const mockResponse = { data: 'cached-data' }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response)

      // First request
      const result1 = await apiService.get(cacheKey, { cache: true })

      // Second request should use cache
      const result2 = await apiService.get(cacheKey, { cache: true })

      expect(fetch).toHaveBeenCalledTimes(1) // Only one actual request
      expect(result1).toEqual(mockResponse)
      expect(result2).toEqual(mockResponse)
    })

    it('should respect cache TTL', async () => {
      vi.useFakeTimers()

      const mockResponse = { data: 'test' }
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response)

      // First request
      await apiService.get('/test-endpoint', { cache: true, cacheTTL: 5000 })

      // Advance time beyond TTL
      vi.advanceTimersByTime(6000)

      // Second request should not use cache
      await apiService.get('/test-endpoint', { cache: true, cacheTTL: 5000 })

      expect(fetch).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('should invalidate cache when specified', async () => {
      const mockResponse = { data: 'test' }
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response)

      // Cache initial request
      await apiService.get('/test-endpoint', { cache: true })

      // Invalidate cache
      apiService.invalidateCache('/test-endpoint')

      // Next request should not use cache
      await apiService.get('/test-endpoint', { cache: true })

      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('File Upload', () => {
    it('should handle file uploads', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const formData = new FormData()
      formData.append('file', file)

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ fileId: 'abc123', url: '/uploads/test.txt' })
      } as Response)

      const result = await apiService.uploadFile('/upload', file)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      )
      expect(result.fileId).toBe('abc123')
    })

    it('should track upload progress', async () => {
      const file = new File(['test content'], 'test.txt')
      const progressCallback = vi.fn()

      // Mock XMLHttpRequest for progress tracking
      const mockXHR = {
        upload: { addEventListener: vi.fn() },
        open: vi.fn(),
        setRequestHeader: vi.fn(),
        send: vi.fn(),
        response: JSON.stringify({ fileId: 'abc123' }),
        status: 200
      }

      global.XMLHttpRequest = vi.fn(() => mockXHR) as any

      await apiService.uploadFile('/upload', file, { onProgress: progressCallback })

      expect(mockXHR.upload.addEventListener).toHaveBeenCalledWith('progress', expect.any(Function))
    })

    it('should handle upload errors', async () => {
      const file = new File(['test content'], 'test.txt')

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 413,
        json: async () => ({ error: 'File too large' })
      } as Response)

      await expect(apiService.uploadFile('/upload', file)).rejects.toThrow('HTTP 413')
    })
  })

  describe('Request Cancellation', () => {
    it('should support request cancellation', async () => {
      const controller = new AbortController()

      vi.mocked(fetch).mockImplementationOnce(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100)
        })
      )

      const requestPromise = apiService.get('/test-endpoint', {
        signal: controller.signal
      })

      controller.abort()

      await expect(requestPromise).rejects.toThrow('AbortError')
    })

    it('should clean up aborted requests', async () => {
      const controller = new AbortController()

      const requestPromise = apiService.get('/test-endpoint', {
        signal: controller.signal
      })

      controller.abort()

      try {
        await requestPromise
      } catch (error) {
        // Request should be removed from pending requests
        expect(apiService.pendingRequests.size).toBe(0)
      }
    })
  })

  describe('Concurrent Request Management', () => {
    it('should deduplicate identical concurrent requests', async () => {
      const mockResponse = { data: 'test' }
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      } as Response)

      // Make multiple identical requests concurrently
      const requests = [
        apiService.get('/test-endpoint'),
        apiService.get('/test-endpoint'),
        apiService.get('/test-endpoint')
      ]

      const results = await Promise.all(requests)

      // Should only make one actual request
      expect(fetch).toHaveBeenCalledTimes(1)

      // All results should be identical
      results.forEach(result => {
        expect(result).toEqual(mockResponse)
      })
    })

    it('should limit concurrent requests', async () => {
      apiService.setMaxConcurrentRequests(2)

      const slowResponse = new Promise(resolve => {
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ data: 'slow' })
        }), 100)
      })

      vi.mocked(fetch).mockReturnValue(slowResponse as Promise<Response>)

      // Start 3 concurrent requests
      const requests = [
        apiService.get('/endpoint1'),
        apiService.get('/endpoint2'),
        apiService.get('/endpoint3')
      ]

      // Initially only 2 should be active
      expect(apiService.activeRequests).toBe(2)
      expect(apiService.queuedRequests).toBe(1)

      await Promise.all(requests)

      expect(fetch).toHaveBeenCalledTimes(3)
    })
  })

  describe('Metrics and Monitoring', () => {
    it('should track request metrics', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' })
      } as Response)

      await apiService.get('/test-endpoint')

      const metrics = apiService.getMetrics()
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.successfulRequests).toBe(1)
      expect(metrics.failedRequests).toBe(0)
      expect(metrics.averageResponseTime).toBeGreaterThan(0)
    })

    it('should track error rates', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: 'success' })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server error' })
        } as Response)

      await apiService.get('/success-endpoint')

      try {
        await apiService.get('/error-endpoint')
      } catch (error) {
        // Expected error
      }

      const metrics = apiService.getMetrics()
      expect(metrics.totalRequests).toBe(2)
      expect(metrics.successfulRequests).toBe(1)
      expect(metrics.failedRequests).toBe(1)
      expect(metrics.errorRate).toBe(0.5)
    })

    it('should provide endpoint-specific metrics', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' })
      } as Response)

      await apiService.get('/endpoint1')
      await apiService.get('/endpoint1')
      await apiService.get('/endpoint2')

      const endpointMetrics = apiService.getEndpointMetrics('/endpoint1')
      expect(endpointMetrics.requestCount).toBe(2)
      expect(endpointMetrics.averageResponseTime).toBeGreaterThan(0)
    })
  })
})
