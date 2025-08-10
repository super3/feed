const { filterPosts } = require('./filter');

describe('Filter Module', () => {
  describe('filterPosts', () => {
    it('should return filter results for posts', async () => {
      const posts = [
        { id: 'post1', title: 'Test Post 1' },
        { id: 'post2', title: 'Test Post 2' }
      ];
      const context = 'test context';

      const results = await filterPosts(posts, context);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 'post1',
        shouldShow: true,
        reason: 'Manual review required'
      });
      expect(results[1]).toEqual({
        id: 'post2',
        shouldShow: true,
        reason: 'Manual review required'
      });
    });

    it('should handle empty posts array', async () => {
      const posts = [];
      const context = 'test context';

      const results = await filterPosts(posts, context);

      expect(results).toHaveLength(0);
    });

    it('should handle posts without id', async () => {
      const posts = [
        { title: 'Test Post without ID' }
      ];
      const context = 'test context';

      const results = await filterPosts(posts, context);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: undefined,
        shouldShow: true,
        reason: 'Manual review required'
      });
    });
  });
});