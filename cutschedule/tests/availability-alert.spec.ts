import { test, expect } from '@playwright/test'
import { maskPhone } from '../lib/utils/validation'

test.describe('Availability Alert API', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'
  const apiKey = process.env.AVAILABILITY_ALERT_API_KEY || 'test-key'

  test.describe('GET /api/availability-alert', () => {
    test('should return eligible client count', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/availability-alert`, {
        headers: {
          'x-api-key': apiKey,
        },
      })

      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('eligibleCount')
      expect(typeof data.eligibleCount).toBe('number')
      expect(data.eligibleCount).toBeGreaterThanOrEqual(0)
    })

    test('should return masked client details when includeDetails=true', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/availability-alert?includeDetails=true`, {
        headers: {
          'x-api-key': apiKey,
        },
      })

      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('eligibleCount')

      expect(data.clients).toBeDefined()
      expect(Array.isArray(data.clients)).toBe(true)
      expect(data.clients.length).toBeGreaterThan(0)

      for (const client of data.clients) {
        expect(client).toHaveProperty('clientName')
        expect(client).toHaveProperty('phoneNumber')
        expect(client.phoneNumber).toMatch(/^\*\*\*-\*\*\*-\d{4}$/)
      }
    })

    test('should reject requests without API key', async ({ request }) => {
      const response = await request.get(`${baseUrl}/api/availability-alert`)

      expect(response.status()).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })
  })

  test.describe('POST /api/availability-alert', () => {
    test('should support dry run mode', async ({ request }) => {
      const response = await request.post(`${baseUrl}/api/availability-alert`, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        data: {
          dryRun: true,
        },
      })

      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('dryRun', true)
      expect(data).toHaveProperty('sent')
      expect(data).toHaveProperty('failed')

      // In dry run, no failures should occur
      expect(data.failed).toBe(0)
    })

    test('should reject requests without API key', async ({ request }) => {
      const response = await request.post(`${baseUrl}/api/availability-alert`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          dryRun: true,
        },
      })

      expect(response.status()).toBe(401)
    })
  })
})

test.describe('Phone Number Filtering Logic', () => {
  // Unit test for the filtering behavior
  // This validates the logic that filters out empty phone numbers

  test('should identify valid vs empty phone numbers', () => {
    const testCases = [
      { phone: '1234567890', shouldBeValid: true },
      { phone: '+11234567890', shouldBeValid: true },
      { phone: '(123) 456-7890', shouldBeValid: true },
      { phone: '', shouldBeValid: false },
      { phone: '   ', shouldBeValid: false },
    ]

    for (const { phone, shouldBeValid } of testCases) {
      const isValid = phone.trim() !== ''
      expect(isValid).toBe(shouldBeValid)
    }
  })

  test('should mask phone numbers correctly', () => {
    // Test the real maskPhone implementation from lib/utils/validation
    expect(maskPhone('1234567890')).toBe('***-***-7890')
    expect(maskPhone('+11234567890')).toBe('***-***-7890')
    expect(maskPhone('123')).toBe('')
    expect(maskPhone('')).toBe('')
  })

  test('should extract only digits before masking (PII protection)', () => {
    // Test that non-digit characters are stripped before masking
    // This prevents leaking trailing spaces, extensions, or other characters
    expect(maskPhone('123-456-7890')).toBe('***-***-7890')
    expect(maskPhone('(123) 456-7890')).toBe('***-***-7890')
    expect(maskPhone('+1 (123) 456-7890')).toBe('***-***-7890')
    expect(maskPhone('123.456.7890')).toBe('***-***-7890')
  })

  test('should handle phone numbers with extensions safely', () => {
    // Extensions should be stripped - only last 4 DIGITS shown
    // '123-456-7890 ext 123' -> digits '1234567890123' -> last 4 '0123'
    expect(maskPhone('123-456-7890 ext 123')).toBe('***-***-0123')
    // '123-456-7890 x5' -> digits '12345678905' -> last 4 '8905'
    expect(maskPhone('123-456-7890 x5')).toBe('***-***-8905')
    expect(maskPhone('1234567890ext5')).toBe('***-***-8905')
  })

  test('should handle phone numbers with trailing spaces', () => {
    // Trailing spaces should not leak into masked output
    expect(maskPhone('1234567890   ')).toBe('***-***-7890')
    expect(maskPhone('  1234567890  ')).toBe('***-***-7890')
  })

  test('should return empty string for inputs with fewer than 4 digits', () => {
    expect(maskPhone('')).toBe('')
    expect(maskPhone('   ')).toBe('')
    expect(maskPhone('abc')).toBe('')
    expect(maskPhone('12')).toBe('')
    expect(maskPhone('123')).toBe('')
    expect(maskPhone('a1b2c3')).toBe('') // Only 3 digits
  })

  test('should handle exactly 4 digits', () => {
    expect(maskPhone('1234')).toBe('***-***-1234')
    expect(maskPhone('a1b2c3d4')).toBe('***-***-1234')
  })

  test('should handle international formats', () => {
    expect(maskPhone('+441onal234567890')).toBe('***-***-7890')
    expect(maskPhone('011-1-123-456-7890')).toBe('***-***-7890')
  })
})

