import { describe, it, expect, vi } from 'vitest'

describe('Simple vi test', () => {
    it('should have vi available', () => {
        expect(vi).toBeDefined()
        expect(vi.fn).toBeDefined()
        expect(vi.mock).toBeDefined()
    })

    it('should create a mock function', () => {
        const mockFn = vi.fn()
        expect(mockFn).toBeDefined()
        expect(typeof mockFn).toBe('function')
    })
})
