const config = require('./config');

describe('Config Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('storage configuration', () => {
    it('should detect Redis URL', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      expect(config.storage.hasRedisUrl).toBe(true);
      expect(config.storage.redisUrl).toBe('redis://localhost:6379');
    });

    it('should detect KV URL', () => {
      delete process.env.REDIS_URL;
      process.env.KV_URL = 'redis://kv.example.com';
      expect(config.storage.hasRedisUrl).toBe(true);
      expect(config.storage.kvUrl).toBe('redis://kv.example.com');
    });

    it('should detect Upstash URL', () => {
      process.env.REDIS_URL = 'redis://default:token@test.upstash.io:6379';
      expect(config.storage.isUpstashUrl).toBe(true);
    });

    it('should detect KV credentials', () => {
      process.env.KV_REST_API_URL = 'https://api.upstash.com';
      process.env.KV_REST_API_TOKEN = 'token123';
      expect(config.storage.hasKvCredentials).toBe(true);
      expect(config.storage.kvRestApiUrl).toBe('https://api.upstash.com');
      expect(config.storage.kvRestApiToken).toBe('token123');
    });

    it('should get effective Redis URL', () => {
      process.env.REDIS_URL = 'redis://primary.com';
      process.env.KV_URL = 'redis://secondary.com';
      expect(config.storage.effectiveRedisUrl).toBe('redis://primary.com');
      
      delete process.env.REDIS_URL;
      expect(config.storage.effectiveRedisUrl).toBe('redis://secondary.com');
    });

    it('should handle Upstash deprecated config', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.com';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token';
      expect(config.storage.upstashRedisRestUrl).toBe('https://upstash.com');
      expect(config.storage.upstashRedisRestToken).toBe('upstash-token');
    });
  });

  describe('proxy configuration', () => {
    it('should detect proxy credentials', () => {
      process.env.PROXY_USER = 'user';
      process.env.PROXY_PASS = 'pass';
      expect(config.proxy.hasCredentials).toBe(true);
      expect(config.proxy.user).toBe('user');
      expect(config.proxy.pass).toBe('pass');
    });

    it('should build proxy URL', () => {
      process.env.PROXY_USER = 'user';
      process.env.PROXY_PASS = 'pass';
      process.env.PROXY_HOST = 'proxy.example.com:8080';
      expect(config.proxy.url).toBe('http://user:pass@proxy.example.com:8080/');
    });

    it('should use default proxy host', () => {
      delete process.env.PROXY_HOST;
      expect(config.proxy.host).toBe('82.26.109.10:5712');
    });

    it('should return null URL without credentials', () => {
      delete process.env.PROXY_USER;
      delete process.env.PROXY_PASS;
      expect(config.proxy.hasCredentials).toBe(false);
      expect(config.proxy.url).toBeNull();
    });
  });

  describe('environment configuration', () => {
    it('should detect Vercel environment', () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_REGION = 'us-east-1';
      expect(config.environment.isVercel).toBe(true);
      expect(config.environment.vercelRegion).toBe('us-east-1');
    });

    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(config.environment.isDevelopment).toBe(true);
      expect(config.environment.isProduction).toBe(false);
      expect(config.environment.isTest).toBe(false);
    });

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      expect(config.environment.isTest).toBe(true);
      expect(config.environment.isDevelopment).toBe(false);
      expect(config.environment.isProduction).toBe(false);
    });

    it('should default to production', () => {
      delete process.env.NODE_ENV;
      expect(config.environment.nodeEnv).toBe('production');
      expect(config.environment.isProduction).toBe(true);
    });

    it('should handle port configuration', () => {
      process.env.PORT = '4000';
      expect(config.environment.port).toBe('4000');
      
      delete process.env.PORT;
      expect(config.environment.port).toBe(3000);
    });
  });

  describe('security configuration', () => {
    it('should detect cron secret', () => {
      process.env.CRON_SECRET = 'secret123';
      expect(config.security.hasCronSecret).toBe(true);
      expect(config.security.cronSecret).toBe('secret123');
    });

    it('should handle missing cron secret', () => {
      delete process.env.CRON_SECRET;
      expect(config.security.hasCronSecret).toBe(false);
      expect(config.security.cronSecret).toBeUndefined();
    });
  });

  describe('AI configuration', () => {
    it('should configure LM Studio', () => {
      process.env.LM_STUDIO_MODEL = 'custom-model';
      process.env.LM_STUDIO_URL = 'http://ai.local:5000';
      process.env.LM_STUDIO_TIMEOUT = '30000';
      
      expect(config.ai.lmStudioModel).toBe('custom-model');
      expect(config.ai.lmStudioUrl).toBe('http://ai.local:5000');
      expect(config.ai.lmStudioTimeout).toBe(30000);
      expect(config.ai.hasLmStudio).toBe(true);
    });

    it('should use default AI configuration', () => {
      delete process.env.LM_STUDIO_MODEL;
      delete process.env.LM_STUDIO_URL;
      delete process.env.LM_STUDIO_TIMEOUT;
      
      expect(config.ai.lmStudioModel).toBe('deepseek/deepseek-r1-0528-qwen3-8b');
      expect(config.ai.lmStudioUrl).toBe('http://localhost:1234');
      expect(config.ai.lmStudioTimeout).toBe(60000);
    });
  });

  describe('paths configuration', () => {
    it('should use /tmp on Vercel by default', () => {
      process.env.VERCEL = '1';
      expect(config.paths.dataDir).toBe('/tmp/feed-data');
    });

    it('should allow custom data directory via env var on Vercel', () => {
      process.env.VERCEL = '1';
      process.env.VERCEL_DATA_DIR = '/custom/data';
      expect(config.paths.dataDir).toBe('/custom/data');
      delete process.env.VERCEL_DATA_DIR;
    });

    it('should use local data directory', () => {
      delete process.env.VERCEL;
      expect(config.paths.dataDir).toMatch(/data$/);
    });
  });

  describe('environment strategies', () => {
    it('should have strategies for all environments', () => {
      expect(config.environmentStrategies).toHaveProperty('vercel');
      expect(config.environmentStrategies).toHaveProperty('development');
      expect(config.environmentStrategies).toHaveProperty('production');
      expect(config.environmentStrategies).toHaveProperty('test');
    });

    it('should provide environment-specific log levels', () => {
      process.env.NODE_ENV = 'test';
      expect(config.logLevel).toBe('silent');
      
      process.env.NODE_ENV = 'production';
      expect(config.logLevel).toBe('warn');
      
      process.env.NODE_ENV = 'development';
      expect(config.logLevel).toBe('debug');
    });

    it('should provide environment-specific max workers', () => {
      process.env.VERCEL = '1';
      expect(config.maxWorkers).toBe(1);
      
      delete process.env.VERCEL;
      process.env.NODE_ENV = 'production';
      expect(config.maxWorkers).toBe(2);
    });
  });

  describe('reddit configuration', () => {
    it('should have correct Reddit API settings', () => {
      expect(config.reddit.searchUrl).toBe('https://www.reddit.com/search/.json');
      expect(config.reddit.userAgent).toContain('Mozilla');
      expect(config.reddit.defaultTimeframe).toBe('hour');
      expect(config.reddit.defaultType).toBe('posts');
      expect(config.reddit.defaultKeyword).toBe('slack');
    });
  });

  describe('keys configuration', () => {
    it('should have correct storage keys', () => {
      expect(config.keys.keywords).toBe('config:keywords');
    });
  });

  describe('getAll method', () => {
    it('should return all configuration sections', () => {
      const allConfig = config.getAll();
      expect(allConfig).toHaveProperty('storage');
      expect(allConfig).toHaveProperty('proxy');
      expect(allConfig).toHaveProperty('environment');
      expect(allConfig).toHaveProperty('security');
      expect(allConfig).toHaveProperty('ai');
      expect(allConfig).toHaveProperty('reddit');
      expect(allConfig).toHaveProperty('paths');
      expect(allConfig).toHaveProperty('keys');
    });
  });
});