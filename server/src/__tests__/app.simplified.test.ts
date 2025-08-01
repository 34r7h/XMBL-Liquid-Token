import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the services before importing the app
vi.mock('../services/oneInchService', () => ({
  oneInchService: {
    initialize: vi.fn(),
    health: vi.fn().mockResolvedValue({ status: 'healthy' })
  }
}))

vi.mock('../services/bitcoinService', () => ({
  bitcoinService: {
    initialize: vi.fn(),
    health: vi.fn().mockResolvedValue({ status: 'healthy' })
  }
}))

vi.mock('../services/yieldManagementService', () => ({
  yieldManagementService: {
    initialize: vi.fn(),
    startAutomation: vi.fn(),
    stop: vi.fn(),
    health: vi.fn().mockResolvedValue({ status: 'healthy' })
  }
}))

vi.mock('../services/blockchainMonitor', () => ({
  blockchainMonitor: {
    initialize: vi.fn(),
    startEventListeners: vi.fn(),
    stopEventListeners: vi.fn(),
    health: vi.fn().mockResolvedValue({ status: 'healthy' })
  }
}))

vi.mock('../services/profitDistributionService', () => ({
  profitDistributionService: {
    initialize: vi.fn(),
    scheduleDistribution: vi.fn(),
    health: vi.fn().mockResolvedValue({ status: 'healthy' })
  }
}))

vi.mock('../utils/database', () => ({
  database: {
    connect: vi.fn(),
    close: vi.fn(),
    health: vi.fn().mockResolvedValue({ status: 'healthy' })
  }
}))

vi.mock('../api/routes', () => ({
  router: {
    get: vi.fn(),
    post: vi.fn(),
    use: vi.fn()
  }
}))

// Mock global objects
global.setInterval = vi.fn()
global.clearInterval = vi.fn()

// Set environment variables
process.env.PORT = '3001'
process.env.NODE_ENV = 'test'

// Now import the app module
import { app, initializeApp, setupRoutes, setupMiddleware, startBackgroundServices, setupWebSocket, gracefulShutdown } from '../app'

describe('Application Entry Point', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Application Initialization', () => {
    it('should initialize application successfully', async () => {
      await initializeApp()

      const { oneInchService } = await import('../services/oneInchService')
      const { bitcoinService } = await import('../services/bitcoinService')
      const { yieldManagementService } = await import('../services/yieldManagementService')
      const { blockchainMonitor } = await import('../services/blockchainMonitor')
      const { profitDistributionService } = await import('../services/profitDistributionService')

      expect(oneInchService.initialize).toHaveBeenCalled()
      expect(bitcoinService.initialize).toHaveBeenCalled()
      expect(yieldManagementService.initialize).toHaveBeenCalled()
      expect(blockchainMonitor.initialize).toHaveBeenCalled()
      expect(profitDistributionService.initialize).toHaveBeenCalled()
    })

    it('should validate environment variables', async () => {
      const originalEnv = process.env.NODE_ENV
      const originalPort = process.env.PORT
      
      // Temporarily change to production to enable validation
      process.env.NODE_ENV = 'production'
      delete process.env.PORT

      await expect(initializeApp()).rejects.toThrow('Missing required environment variable: PORT')
      
      // Restore for other tests
      process.env.NODE_ENV = originalEnv
      process.env.PORT = originalPort || '3001'
    })

    it('should set up database connection', async () => {
      const { database } = await import('../utils/database')

      await initializeApp()

      expect(database.connect).toHaveBeenCalled()
    })

    it('should initialize services in correct order', async () => {
      const initOrder: string[] = []

      const { database } = await import('../utils/database')
      const { oneInchService } = await import('../services/oneInchService')
      const { bitcoinService } = await import('../services/bitcoinService')
      const { blockchainMonitor } = await import('../services/blockchainMonitor')

      vi.mocked(database.connect).mockImplementation(() => {
        initOrder.push('database')
        return Promise.resolve()
      })

      vi.mocked(oneInchService.initialize).mockImplementation(() => {
        initOrder.push('oneInch')
        return Promise.resolve()
      })

      vi.mocked(bitcoinService.initialize).mockImplementation(() => {
        initOrder.push('bitcoin')
        return Promise.resolve()
      })

      vi.mocked(blockchainMonitor.initialize).mockImplementation(() => {
        initOrder.push('monitor')
        return Promise.resolve()
      })

      await initializeApp()

      expect(initOrder[0]).toBe('database')
      expect(initOrder).toContain('oneInch')
      expect(initOrder).toContain('bitcoin')
      expect(initOrder).toContain('monitor')
    })

    it('should configure error handling', async () => {
      await initializeApp()

      expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0)
      expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(0)
    })
  })

  describe('Route Setup', () => {
    it('should configure API routes', async () => {
      const { router } = await import('../api/routes')

      await setupRoutes()

      expect(router.use).toHaveBeenCalled()
    })

    it('should setup health check route', async () => {
      const { router } = await import('../api/routes')

      await setupRoutes()

      expect(router.get).toHaveBeenCalledWith('/health', expect.any(Function))
    })
  })

  describe('Background Services', () => {
    it('should start all background services', async () => {
      await startBackgroundServices()

      const { yieldManagementService } = await import('../services/yieldManagementService')
      const { blockchainMonitor } = await import('../services/blockchainMonitor')
      const { profitDistributionService } = await import('../services/profitDistributionService')

      expect(yieldManagementService.startAutomation).toHaveBeenCalled()
      expect(blockchainMonitor.startEventListeners).toHaveBeenCalled()
      expect(profitDistributionService.scheduleDistribution).toHaveBeenCalled()
    })

    it('should implement service health monitoring', async () => {
      await startBackgroundServices()

      expect(setInterval).toHaveBeenCalled()
    })

    it('should handle service restart on failure', async () => {
      const { blockchainMonitor } = await import('../services/blockchainMonitor')
      
      vi.mocked(blockchainMonitor.startEventListeners)
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce(undefined)

      await startBackgroundServices()

      expect(blockchainMonitor.startEventListeners).toHaveBeenCalledTimes(2)
    })
  })

  describe('Health Monitoring', () => {
    it('should implement comprehensive health checks', async () => {
      await initializeApp()

      const healthStatus = await app.getHealthStatus()

      expect(healthStatus).toHaveProperty('status')
      expect(healthStatus).toHaveProperty('services')
      expect(healthStatus).toHaveProperty('uptime')
      expect(healthStatus).toHaveProperty('memory')
    })

    it('should provide detailed health metrics', async () => {
      await initializeApp()

      const healthStatus = await app.getHealthStatus()

      expect(healthStatus).toHaveProperty('database')
      expect(healthStatus).toHaveProperty('externalServices')
      expect(healthStatus).toHaveProperty('backgroundTasks')
      expect(healthStatus).toHaveProperty('lastUpdated')
    })
  })

  describe('Graceful Shutdown', () => {
    it('should handle SIGTERM gracefully', async () => {
      // Mock process.exit to prevent actual exit
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('Process exit called')
      }) as any)

      await initializeApp()
      await startBackgroundServices()

      try {
        await gracefulShutdown('SIGTERM')
      } catch (error: any) {
        expect(error.message).toBe('Process exit called')
      }

      const { blockchainMonitor } = await import('../services/blockchainMonitor')
      const { yieldManagementService } = await import('../services/yieldManagementService')

      expect(blockchainMonitor.stopEventListeners).toHaveBeenCalled()
      expect(yieldManagementService.stop).toHaveBeenCalled()

      processExitSpy.mockRestore()
    })

    it('should close database connections', async () => {
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('Process exit called')
      }) as any)

      await initializeApp()

      const { database } = await import('../utils/database')

      try {
        await gracefulShutdown('SIGTERM')
      } catch (error: any) {
        expect(error.message).toBe('Process exit called')
      }

      expect(database.close).toHaveBeenCalled()

      processExitSpy.mockRestore()
    })
  })
})
