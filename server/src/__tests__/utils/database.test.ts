import { describe, it, expect, beforeEach } from 'vitest'
import { database } from '../../utils/database'

describe('Database Utility', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test'
  })

  describe('Health Check', () => {
    it('should return health status', async () => {
      const health = await database.health()
      
      expect(health).toHaveProperty('status')
      expect(['healthy', 'unhealthy']).toContain(health.status)
      if (health.message) {
        expect(typeof health.message).toBe('string')
      }
    })
  })

  describe('Connection Management', () => {
    it('should establish database connection', async () => {
      await database.connect()
      expect(database.isConnected).toBe(true)
    })

    it('should close database connection', async () => {
      await database.connect()
      await database.close()
      expect(database.isConnected).toBe(false)
    })

    it('should check connection status', async () => {
      await database.connect()
      const health = await database.health()
      expect(health.status).toBe('healthy')
      
      await database.close()
      const healthAfterClose = await database.health()
      expect(healthAfterClose.status).toBe('unhealthy')
    })
  })

  describe('Basic CRUD Operations', () => {
    beforeEach(async () => {
      await database.connect()
    })

    it('should execute queries', async () => {
      const result = await database.query('SELECT * FROM users')
      
      expect(Array.isArray(result)).toBe(true)
    })

    it('should insert data', async () => {
      const data = {
        name: 'Test User',
        email: 'test@example.com'
      }
      
      const result = await database.insert('users', data)
      
      expect(result).toHaveProperty('id')
      expect(typeof result.id).toBe('number')
    })

    it('should update data', async () => {
      const data = { name: 'Updated User' }
      const where = { id: 1 }
      
      const rowsAffected = await database.update('users', data, where)
      
      expect(typeof rowsAffected).toBe('number')
      expect(rowsAffected).toBeGreaterThanOrEqual(0)
    })

    it('should delete data', async () => {
      const where = { id: 1 }
      
      const rowsDeleted = await database.delete('users', where)
      
      expect(typeof rowsDeleted).toBe('number')
      expect(rowsDeleted).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle operations when not connected', async () => {
      await database.close()
      
      await expect(database.query('SELECT * FROM users'))
        .rejects.toThrow('Database not connected')
      
      await expect(database.insert('users', {}))
        .rejects.toThrow('Database not connected')
      
      await expect(database.update('users', {}, {}))
        .rejects.toThrow('Database not connected')
      
      await expect(database.delete('users', {}))
        .rejects.toThrow('Database not connected')
    })

    it('should return unhealthy status when disconnected', async () => {
      await database.close()
      const health = await database.health()
      
      expect(health.status).toBe('unhealthy')
      expect(health.message).toBe('Database not connected')
    })
  })

  describe('Test Environment Behavior', () => {
    beforeEach(async () => {
      await database.connect()
    })

    it('should return empty array for queries in test mode', async () => {
      const result = await database.query('SELECT * FROM test_table')
      
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(0)
    })

    it('should return random ID for inserts in test mode', async () => {
      const result1 = await database.insert('test_table', { data: 'test1' })
      const result2 = await database.insert('test_table', { data: 'test2' })
      
      expect(typeof result1.id).toBe('number')
      expect(typeof result2.id).toBe('number')
      expect(result1.id).toBeGreaterThan(0)
      expect(result2.id).toBeGreaterThan(0)
    })

    it('should return 1 for updates in test mode', async () => {
      const rowsAffected = await database.update('test_table', { data: 'updated' }, { id: 1 })
      
      expect(rowsAffected).toBe(1)
    })

    it('should return 1 for deletes in test mode', async () => {
      const rowsDeleted = await database.delete('test_table', { id: 1 })
      
      expect(rowsDeleted).toBe(1)
    })
  })
})
