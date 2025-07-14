const handler = require('./filtered-posts');
const { getStorage, resetStorage } = require('../lib/storage');
const fs = require('fs').promises;
const path = require('path');

// Mock storage data
const mockFilteredSession = {
  keyword: 'obsidian',
  context: 'the note-taking app',
  sessionId: '2025-07-14T16:51:36.089Z',
  status: 'completed',
  stats: {
    totalPosts: 3,
    processed: 3,
    relevantCount: 1,
    notRelevantCount: 2
  },
  posts: {
    relevant: [
      {
        id: '1lya8yt',
        title: 'Recommandation for an eink dedicated to japanese learning',
        author: 'Oshikafu',
        url: 'https://www.reddit.com/r/eink/comments/1lya8yt/recommandation_for_an_eink_dedicated_to_japanese/',
        selftext: 'I have a specific workflow in mind...',
        filterReason: 'YES'
      }
    ],
    notRelevant: [
      {
        id: '1lyaehk',
        title: 'Counter oven for the win !!',
        author: 'KeyAcanthocephala881',
        url: 'https://www.reddit.com/r/GunPorn/comments/1lyaehk/counter_oven_for_the_win/',
        selftext: 'New frontier c-45 with 50 shades of FDE RUGGED OBSIDIAN 45',
        filterReason: 'NO'
      },
      {
        id: '1ly9wda',
        title: '[WTS] Freeman Shipyard Store vol.4',
        author: 'Freeman_Alex',
        url: 'https://www.reddit.com/r/Starcitizen_trades/comments/1ly9wda/wts_freeman_shipyard_store_vol4_hazard_patch/',
        selftext: 'Freeman Old Star Shipyard...',
        filterReason: 'NO'
      }
    ]
  }
};

describe('/api/filtered-posts', () => {
  let req, res, dataDir;

  beforeEach(async () => {
    resetStorage();
    
    // Set up data directory
    dataDir = path.join(__dirname, '..', 'test-data');
    process.env.DATA_DIR = dataDir;
    
    // Create test data directory
    await fs.mkdir(dataDir, { recursive: true });
    
    // Create a mock filtered session file
    const sessionKey = `filtered:${mockFilteredSession.keyword}:${mockFilteredSession.context}:${mockFilteredSession.sessionId}`;
    await fs.writeFile(
      path.join(dataDir, `${sessionKey}.json`),
      JSON.stringify(mockFilteredSession, null, 2)
    );
    
    req = {
      method: 'GET',
      query: {}
    };
    
    res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(dataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors
    }
    delete process.env.DATA_DIR;
  });

  it('should return filtered results for a specific keyword', async () => {
    req.query = { keyword: 'obsidian' };
    
    await handler(req, res);
    
    expect(res.json).toHaveBeenCalledWith({
      filtered: true,
      keyword: 'obsidian',
      context: 'the note-taking app',
      sessionId: '2025-07-14T16:51:36.089Z',
      stats: mockFilteredSession.stats,
      relevantPosts: mockFilteredSession.posts.relevant,
      notRelevantPosts: mockFilteredSession.posts.notRelevant
    });
  });

  it('should return filtered results for keyword and context', async () => {
    req.query = { keyword: 'obsidian', context: 'the note-taking app' };
    
    await handler(req, res);
    
    expect(res.json).toHaveBeenCalledWith({
      filtered: true,
      keyword: 'obsidian',
      context: 'the note-taking app',
      sessionId: '2025-07-14T16:51:36.089Z',
      stats: mockFilteredSession.stats,
      relevantPosts: mockFilteredSession.posts.relevant,
      notRelevantPosts: mockFilteredSession.posts.notRelevant
    });
  });

  it('should return not filtered when no sessions exist', async () => {
    req.query = { keyword: 'nonexistent' };
    
    await handler(req, res);
    
    expect(res.json).toHaveBeenCalledWith({
      filtered: false,
      posts: []
    });
  });

  it('should reject non-GET methods', async () => {
    req.method = 'POST';
    
    await handler(req, res);
    
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('should handle incomplete sessions', async () => {
    // Create an incomplete session
    const incompleteSession = { ...mockFilteredSession, status: 'in_progress' };
    const sessionKey = `filtered:test:context:2025-07-14T17:00:00.000Z`;
    await fs.writeFile(
      path.join(dataDir, `${sessionKey}.json`),
      JSON.stringify(incompleteSession, null, 2)
    );
    
    req.query = { keyword: 'test' };
    
    await handler(req, res);
    
    expect(res.json).toHaveBeenCalledWith({
      filtered: false,
      posts: []
    });
  });
});