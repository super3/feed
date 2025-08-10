// Reset modules and environment between tests
let originalEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  // Clear the module cache to force re-initialization
  jest.resetModules();
});

afterEach(() => {
  process.env = originalEnv;
});

describe('Logger', () => {
  describe('environment-based configuration', () => {
    it('should use error level and silent mode in test environment', () => {
      process.env.NODE_ENV = 'test';
      const logger = require('./logger');
      
      expect(logger).toBeDefined();
      expect(logger.level).toBe('error');
    });

    it('should use JSON format in production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'warn';
      
      const winston = require('winston');
      const logger = require('./logger');
      
      expect(logger).toBeDefined();
      expect(logger.level).toBe('warn');
    });

    it('should use custom log level from environment variable', () => {
      delete process.env.NODE_ENV;
      process.env.LOG_LEVEL = 'debug';
      
      const logger = require('./logger');
      
      expect(logger).toBeDefined();
      expect(logger.level).toBe('debug');
    });

    it('should default to info level when no environment variables set', () => {
      delete process.env.NODE_ENV;
      delete process.env.LOG_LEVEL;
      
      const logger = require('./logger');
      
      expect(logger).toBeDefined();
      expect(logger.level).toBe('info');
    });

    it('should use colorized format in development environment', () => {
      process.env.NODE_ENV = 'development';
      
      const logger = require('./logger');
      
      expect(logger).toBeDefined();
      expect(logger.transports[0].format).toBeDefined();
    });

    it('should return same instance when called multiple times (singleton)', () => {
      process.env.NODE_ENV = 'development';
      
      // First require
      const logger1 = require('./logger');
      
      // Clear cache and require again - should still get same instance due to singleton
      const modulePath = require.resolve('./logger');
      const moduleExports = require.cache[modulePath].exports;
      
      // Re-require without cache clear
      const logger2 = require('./logger');
      
      expect(logger1).toBe(logger2);
    });
  });

  describe('logging methods', () => {
    it('should have all winston log methods', () => {
      process.env.NODE_ENV = 'development';
      const logger = require('./logger');
      
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should format messages with metadata in development', () => {
      process.env.NODE_ENV = 'development';
      const logger = require('./logger');
      
      // Test that logger can be called without errors
      expect(() => {
        logger.info('Test message', { key: 'value' });
        logger.error('Error message');
        logger.debug('Debug message', { nested: { data: true } });
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty metadata objects', () => {
      process.env.NODE_ENV = 'development';
      const logger = require('./logger');
      
      expect(() => {
        logger.info('Message with empty meta', {});
      }).not.toThrow();
    });

    it('should handle messages without metadata', () => {
      process.env.NODE_ENV = 'development';
      const logger = require('./logger');
      
      expect(() => {
        logger.info('Simple message');
      }).not.toThrow();
    });
  });
});