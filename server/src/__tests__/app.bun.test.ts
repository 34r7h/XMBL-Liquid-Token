import { test, expect, mock, beforeEach, describe } from "bun:test";

// Mock the modules
const mockOneInchService = {
  initialize: mock(() => Promise.resolve()),
  health: mock(() => Promise.resolve({ status: 'healthy' }))
};

const mockBitcoinService = {
  initialize: mock(() => Promise.resolve()),
  health: mock(() => Promise.resolve({ status: 'healthy' }))
};

const mockYieldManagementService = {
  initialize: mock(() => Promise.resolve()),
  startAutomation: mock(() => Promise.resolve()),
  stop: mock(() => Promise.resolve()),
  health: mock(() => Promise.resolve({ status: 'healthy' }))
};

const mockBlockchainMonitor = {
  initialize: mock(() => Promise.resolve()),
  startEventListeners: mock(() => Promise.resolve()),
  stopEventListeners: mock(() => Promise.resolve()),
  health: mock(() => Promise.resolve({ status: 'healthy' }))
};

const mockProfitDistributionService = {
  initialize: mock(() => Promise.resolve()),
  scheduleDistribution: mock(() => Promise.resolve()),
  health: mock(() => Promise.resolve({ status: 'healthy' }))
};

const mockDatabase = {
  connect: mock(() => Promise.resolve()),
  close: mock(() => Promise.resolve()),
  health: mock(() => Promise.resolve({ status: 'healthy' }))
};

const mockRouter = {
  get: mock(() => {}),
  post: mock(() => {}),
  use: mock(() => {})
};

// Mock the modules
mock.module('../services/oneInchService', () => ({
  oneInchService: mockOneInchService
}));

mock.module('../services/bitcoinService', () => ({
  bitcoinService: mockBitcoinService
}));

mock.module('../services/yieldManagementService', () => ({
  yieldManagementService: mockYieldManagementService
}));

mock.module('../services/blockchainMonitor', () => ({
  blockchainMonitor: mockBlockchainMonitor
}));

mock.module('../services/profitDistributionService', () => ({
  profitDistributionService: mockProfitDistributionService
}));

mock.module('../utils/database', () => ({
  database: mockDatabase
}));

mock.module('../api/routes', () => ({
  router: mockRouter
}));

// Set environment variables
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';

// Import after mocking
import { app, initializeApp, setupRoutes, startBackgroundServices, gracefulShutdown } from '../app';

describe('Application Entry Point', () => {
  beforeEach(() => {
    // Clear mock calls
    Object.values(mockOneInchService).forEach(mockFn => mockFn.mockClear());
    Object.values(mockBitcoinService).forEach(mockFn => mockFn.mockClear());
    Object.values(mockYieldManagementService).forEach(mockFn => mockFn.mockClear());
    Object.values(mockBlockchainMonitor).forEach(mockFn => mockFn.mockClear());
    Object.values(mockProfitDistributionService).forEach(mockFn => mockFn.mockClear());
    Object.values(mockDatabase).forEach(mockFn => mockFn.mockClear());
    Object.values(mockRouter).forEach(mockFn => mockFn.mockClear());
  });

  test('should initialize application successfully', async () => {
    await initializeApp();

    expect(mockOneInchService.initialize).toHaveBeenCalled();
    expect(mockBitcoinService.initialize).toHaveBeenCalled();
    expect(mockYieldManagementService.initialize).toHaveBeenCalled();
    expect(mockBlockchainMonitor.initialize).toHaveBeenCalled();
    expect(mockProfitDistributionService.initialize).toHaveBeenCalled();
  });

  test('should validate environment variables', async () => {
    const originalPort = process.env.PORT;
    delete process.env.PORT;

    expect(initializeApp()).rejects.toThrow('Missing required environment variable: PORT');
    
    // Restore for other tests
    process.env.PORT = originalPort;
  });

  test('should set up database connection', async () => {
    await initializeApp();
    expect(mockDatabase.connect).toHaveBeenCalled();
  });

  test('should configure API routes', async () => {
    await setupRoutes();
    expect(mockRouter.use).toHaveBeenCalled();
  });

  test('should setup health check route', async () => {
    await setupRoutes();
    expect(mockRouter.get).toHaveBeenCalledWith('/health', expect.any(Function));
  });

  test('should start all background services', async () => {
    await startBackgroundServices();

    expect(mockYieldManagementService.startAutomation).toHaveBeenCalled();
    expect(mockBlockchainMonitor.startEventListeners).toHaveBeenCalled();
    expect(mockProfitDistributionService.scheduleDistribution).toHaveBeenCalled();
  });

  test('should implement comprehensive health checks', async () => {
    await initializeApp();

    const healthStatus = await app.getHealthStatus();

    expect(healthStatus).toHaveProperty('status');
    expect(healthStatus).toHaveProperty('services');
    expect(healthStatus).toHaveProperty('uptime');
    expect(healthStatus).toHaveProperty('memory');
  });

  test('should provide detailed health metrics', async () => {
    await initializeApp();

    const healthStatus = await app.getHealthStatus();

    expect(healthStatus).toHaveProperty('database');
    expect(healthStatus).toHaveProperty('externalServices');
    expect(healthStatus).toHaveProperty('backgroundTasks');
    expect(healthStatus).toHaveProperty('lastUpdated');
  });

  test('should handle graceful shutdown', async () => {
    const processExitSpy = mock(() => {
      throw new Error('Process exit called');
    });
    const originalExit = process.exit;
    process.exit = processExitSpy as any;

    await initializeApp();
    await startBackgroundServices();

    try {
      await gracefulShutdown('SIGTERM');
    } catch (error: any) {
      expect(error.message).toBe('Process exit called');
    }

    expect(mockBlockchainMonitor.stopEventListeners).toHaveBeenCalled();
    expect(mockYieldManagementService.stop).toHaveBeenCalled();
    expect(mockDatabase.close).toHaveBeenCalled();

    process.exit = originalExit;
  });
});
