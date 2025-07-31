// Type definitions
export interface ApiResponse<T = any> {
    data: T
    success: boolean
    message?: string
    metadata?: any
}

export interface TokenQuote {
    fromToken: string
    toToken: string
    fromAmount: string
    toAmount: string
    estimatedGas: string
    slippage: number
    route: any[]
}

export interface YieldData {
    currentAPY: number
    totalValueLocked: string
    protocolYields: string
    lastUpdated: Date
}

export interface PortfolioData {
    totalValue: string
    nftCount: number
    accruedYields: string
    nfts: any[]
    performance: {
        daily: number
        weekly: number
        monthly: number
    }
}

export interface TransactionHistory {
    id: string
    hash: string
    type: string
    amount: string
    status: string
    timestamp: Date
    gasUsed?: string
    gasPrice?: string
}

export interface ProtocolStats {
    totalDeposits: string
    activeNFTs: number
    averageAPY: number
    totalUsers: number
    volume24h: string
}

export interface TokenPrice {
    address: string
    symbol: string
    price: number
    change24h: number
    lastUpdated: Date
}

export interface TransactionData {
    type: string
    hash?: string
    from: string
    to?: string
    value?: string
    data?: string
    status: string
}

export interface RequestOptions {
    retry?: boolean
    maxRetries?: number
    cache?: boolean
    timeout?: number
    headers?: Record<string, string>
    params?: Record<string, any>
    signal?: AbortSignal
}

export interface RequestMetrics {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    averageResponseTime: number
    errorRate: number
    endpointMetrics: Map<string, EndpointMetrics>
}

export interface EndpointMetrics {
    requestCount: number
    averageResponseTime: number
    lastRequestTime: Date
    errorCount: number
}

class ApiService {
    private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()
    private requestInterceptors: ((config: any) => any)[] = []
    private responseInterceptors: ((response: any) => any)[] = []
    private _activeRequests: Set<string> = new Set()
    private _queuedRequests: Array<{ key: string; resolve: Function; reject: Function }> = []
    private maxConcurrentRequests = 10
    private metrics: RequestMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        endpointMetrics: new Map()
    }

    constructor() {
        // No axios setup needed - using fetch
    }

    get baseURL(): string {
        return (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api'
    }

    get timeout(): number {
        return 10000 // 10 seconds
    }

    get defaultHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }

    get activeRequests(): number {
        return this._activeRequests.size
    }

    get queuedRequests(): number {
        return this._queuedRequests.length
    }

    setAuthToken(token: string | null): void {
        if (token) {
            localStorage.setItem('authToken', token)
        } else {
            localStorage.removeItem('authToken')
        }
    }

    clearAuthToken(): void {
        localStorage.removeItem('authToken')
    }

    getAuthHeader(): Record<string, string> {
        const token = localStorage.getItem('authToken')
        return token ? { Authorization: `Bearer ${token}` } : {}
    }

    private hasRefreshToken(): boolean {
        return !!localStorage.getItem('refreshToken')
    }

    private async refreshAuthToken(): Promise<string> {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) {
            throw new Error('No refresh token available')
        }

        const response = await fetch(`${this.baseURL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
        })

        if (!response.ok) {
            throw new Error('Token refresh failed')
        }

        const data = await response.json()
        return data.accessToken
    }

    private clearRefreshToken(): void {
        localStorage.removeItem('refreshToken')
    }

    addRequestInterceptor(interceptor: (config: any) => any): void {
        this.requestInterceptors.push(interceptor)
    }

    addResponseInterceptor(interceptor: (response: any) => any): void {
        this.responseInterceptors.push(interceptor)
    }

    setMaxConcurrentRequests(max: number): void {
        this.maxConcurrentRequests = max
    }

    private updateMetrics(endpoint: string, responseTime: number, success: boolean): void {
        this.metrics.totalRequests++

        // Update average response time
        const total = this.metrics.totalRequests
        this.metrics.averageResponseTime =
            ((this.metrics.averageResponseTime * (total - 1)) + responseTime) / total

        // Update error rate
        this.metrics.errorRate = this.metrics.failedRequests / this.metrics.totalRequests

        // Update endpoint-specific metrics
        let endpointMetrics = this.metrics.endpointMetrics.get(endpoint)
        if (!endpointMetrics) {
            endpointMetrics = {
                requestCount: 0,
                averageResponseTime: 0,
                lastRequestTime: new Date(),
                errorCount: 0
            }
            this.metrics.endpointMetrics.set(endpoint, endpointMetrics)
        }

        endpointMetrics.requestCount++
        endpointMetrics.lastRequestTime = new Date()
        endpointMetrics.averageResponseTime =
            ((endpointMetrics.averageResponseTime * (endpointMetrics.requestCount - 1)) + responseTime) / endpointMetrics.requestCount

        if (!success) {
            endpointMetrics.errorCount++
        }
    }

    getMetrics(): RequestMetrics {
        return { ...this.metrics }
    }

    getEndpointMetrics(endpoint: string): EndpointMetrics | undefined {
        return this.metrics.endpointMetrics.get(endpoint)
    }

    private getCacheKey(url: string, params?: any): string {
        return `${url}:${JSON.stringify(params || {})}`
    }

    private getFromCache(key: string): any | null {
        const cached = this.cache.get(key)
        if (!cached) return null

        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key)
            return null
        }

        return cached.data
    }

    private setCache(key: string, data: any, ttl: number = 300000): void { // 5 minutes default
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        })
    }

    private buildURL(url: string, params?: Record<string, any>): string {
        const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`
        if (!params || Object.keys(params).length === 0) {
            return fullURL
        }

        const urlObj = new URL(fullURL)
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                urlObj.searchParams.append(key, String(value))
            }
        })
        return urlObj.toString()
    }

    private async makeRequest<T>(
        method: string,
        url: string,
        options: RequestOptions = {},
        data?: any
    ): Promise<T> {
        const startTime = Date.now()
        const cacheKey = this.getCacheKey(url, options.params)

        // Check cache for GET requests
        if (method === 'GET' && options.cache) {
            const cached = this.getFromCache(cacheKey)
            if (cached) {
                return cached
            }
        }

        // Handle concurrent request limiting
        const requestKey = `${method}:${url}`
        if (this._activeRequests.size >= this.maxConcurrentRequests) {
            await new Promise((resolve, reject) => {
                this._queuedRequests.push({ key: requestKey, resolve, reject })
            })
        }

        this._activeRequests.add(requestKey)

        try {
            let response: Response
            let retries = 0
            const maxRetries = options.maxRetries || 2

            while (retries <= maxRetries) {
                try {
                    // Build request config
                    let config: any = {
                        method,
                        headers: { ...this.defaultHeaders }
                    }

                    // Apply custom request interceptors
                    for (const interceptor of this.requestInterceptors) {
                        config = interceptor(config)
                    }

                    // Add auth header if token exists
                    const authHeader = this.getAuthHeader()
                    if (authHeader.Authorization) {
                        Object.assign(config.headers, authHeader)
                    }

                    // Add custom headers
                    if (options.headers) {
                        Object.assign(config.headers, options.headers)
                    }

                    // Add body for non-GET requests
                    if (data && method !== 'GET') {
                        if (data instanceof FormData) {
                            // Don't set content-type for FormData, let browser set it
                            delete config.headers['Content-Type']
                            config.body = data
                        } else {
                            config.body = JSON.stringify(data)
                        }
                    }

                    // Add abort signal if provided
                    if (options.signal) {
                        config.signal = options.signal
                    }

                    // Build full URL with query params
                    const fullURL = this.buildURL(url, options.params)

                    response = await fetch(fullURL, config)
                    break
                } catch (error: any) {
                    retries++

                    // Don't retry client errors (4xx) or if retry is disabled
                    if (!options.retry || retries > maxRetries ||
                        (error.name === 'AbortError')) {
                        throw error
                    }

                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000 * retries))
                }
            }

            // Handle HTTP errors
            if (!response!.ok) {
                const errorText = await response!.text()
                const responseTime = Date.now() - startTime
                this.updateMetrics(url, responseTime, false)
                this.metrics.failedRequests++

                // Handle 401 errors with token refresh
                if (response!.status === 401 && this.hasRefreshToken()) {
                    try {
                        const newToken = await this.refreshAuthToken()
                        this.setAuthToken(newToken)

                        // Retry original request with new token
                        return this.makeRequest<T>(method, url, options, data)
                    } catch (refreshError) {
                        this.clearAuthToken()
                        this.clearRefreshToken()
                        throw new Error('Authentication failed')
                    }
                }

                throw new Error(`HTTP ${response!.status}: ${errorText}`)
            }

            // Parse response
            let responseData: any
            const contentType = response!.headers.get('content-type')
            if (contentType && contentType.includes('application/json')) {
                responseData = await response!.json()
            } else {
                responseData = await response!.text()
            }

            // Apply custom response interceptors
            let modifiedResponse = responseData
            for (const interceptor of this.responseInterceptors) {
                modifiedResponse = interceptor(modifiedResponse)
            }

            const responseTime = Date.now() - startTime
            this.updateMetrics(url, responseTime, true)
            this.metrics.successfulRequests++

            // Cache GET responses if caching is enabled
            if (method === 'GET' && options.cache) {
                this.setCache(cacheKey, modifiedResponse)
            }

            return modifiedResponse
        } catch (error: any) {
            const responseTime = Date.now() - startTime
            this.updateMetrics(url, responseTime, false)
            this.metrics.failedRequests++
            throw error
        } finally {
            this._activeRequests.delete(requestKey)

            // Process queued requests
            if (this._queuedRequests.length > 0) {
                const next = this._queuedRequests.shift()
                if (next) {
                    next.resolve()
                }
            }
        }
    }

    async get<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
        return this.makeRequest<T>('GET', url, options)
    }

    async post<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
        return this.makeRequest<T>('POST', url, options, data)
    }

    async put<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
        return this.makeRequest<T>('PUT', url, options, data)
    }

    async patch<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<T> {
        return this.makeRequest<T>('PATCH', url, options, data)
    }

    async delete<T = any>(url: string, options: RequestOptions = {}): Promise<T> {
        return this.makeRequest<T>('DELETE', url, options)
    }

    async uploadFile(url: string, file: File, options: { onProgress?: (progress: number) => void } = {}): Promise<any> {
        const formData = new FormData()
        formData.append('file', file)

        if (options.onProgress) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest()

                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const progress = (event.loaded / event.total) * 100
                        options.onProgress!(progress)
                    }
                })

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.response))
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}`))
                    }
                })

                xhr.addEventListener('error', () => {
                    reject(new Error('Upload failed'))
                })

                xhr.open('POST', `${this.baseURL}${url}`)

                const authHeader = this.getAuthHeader()
                if (authHeader.Authorization) {
                    xhr.setRequestHeader('Authorization', authHeader.Authorization)
                }

                xhr.send(formData)
            })
        }

        return this.post(url, formData, {
            headers: {} // Let browser set content-type for FormData
        })
    }

    // XMBL Protocol specific API methods
    async getTokenQuote(fromToken: string, toToken: string, amount: string): Promise<TokenQuote> {
        return this.get('/quotes', {
            params: { fromToken, toToken, amount },
            cache: true
        })
    }

    async getYieldData(): Promise<YieldData> {
        return this.get('/yield', { cache: true })
    }

    async getUserPortfolio(address: string): Promise<PortfolioData> {
        return this.get(`/portfolio/${address}`, { cache: true })
    }

    async getTransactionHistory(address: string): Promise<TransactionHistory[]> {
        return this.get(`/transactions/${address}`, { cache: true })
    }

    async getProtocolStats(): Promise<ProtocolStats> {
        return this.get('/stats', { cache: true })
    }

    async getBondingCurveRate(): Promise<number> {
        const response = await this.get('/bonding-curve', { cache: true })
        return response.rate
    }

    async submitTransaction(txData: TransactionData): Promise<string> {
        const response = await this.post('/transactions', txData)
        return response.id
    }

    async getTokenPrices(tokens: string[]): Promise<TokenPrice[]> {
        return this.get('/prices', {
            params: { tokens: tokens.join(',') },
            cache: true
        })
    }
}

// Export singleton instance
const apiService = new ApiService()
export { ApiService }
export default apiService
