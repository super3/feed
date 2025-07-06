// Node.js 22+ has native fetch, no import needed
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  dataFile: path.join(__dirname, 'reddit-data.json'),
  outputFile: path.join(__dirname, 'reddit-output.json'),
  searchUrl: 'https://www.reddit.com/search/.json',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

/**
 * Load previously posted IDs from file
 */
async function loadPostedIds() {
  try {
    const data = await fs.readFile(CONFIG.dataFile, 'utf8');
    return new Set(JSON.parse(data).postedIds || []);
  } catch (error) {
    // File doesn't exist yet
    return new Set();
  }
}

/**
 * Save posted IDs to file
 */
async function savePostedIds(postedIds) {
  const data = {
    postedIds: Array.from(postedIds),
    lastUpdated: new Date().toISOString()
  };
  await fs.writeFile(CONFIG.dataFile, JSON.stringify(data, null, 2));
}

/**
 * Append posts to output file
 */
async function saveOutput(posts) {
  const timestamp = new Date().toISOString();
  const output = {
    timestamp,
    count: posts.length,
    posts: posts.map(post => ({
      id: post.id,
      title: post.title,
      url: post.url,
      subreddit: post.subreddit,
      score: post.score,
      created: new Date(post.created_utc * 1000).toISOString()
    }))
  };

  try {
    // Read existing output
    const existing = await fs.readFile(CONFIG.outputFile, 'utf8');
    const allOutput = JSON.parse(existing);
    allOutput.push(output);
    await fs.writeFile(CONFIG.outputFile, JSON.stringify(allOutput, null, 2));
  } catch (error) {
    // First run, create new file
    await fs.writeFile(CONFIG.outputFile, JSON.stringify([output], null, 2));
  }

  // Also write to console for immediate visibility
  console.log('\n📊 New Reddit Posts Found:');
  posts.forEach(post => {
    console.log(`\n🔴 ${post.title}`);
    console.log(`   📍 r/${post.subreddit.substring(2)} | ⬆️ ${post.score} | 💬 ${post.num_comments}`);
    console.log(`   🔗 ${post.url}`);
  });
}

/**
 * Fetch Reddit posts for a keyword
 */
async function fetchRedditPosts(keyword = 'slack') {
  try {
    console.log(`🔍 Searching Reddit for: "${keyword}" in the last hour...`);
    
    // Load previously posted IDs
    const postedIds = await loadPostedIds();
    console.log(`📋 Found ${postedIds.size} previously posted items`);

    // Search Reddit
    const url = `${CONFIG.searchUrl}?q=${encodeURIComponent(keyword)}&type=posts&t=hour`;
    const response = await fetch(url, {
      headers: { 'User-Agent': CONFIG.userAgent }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const newPosts = [];

    // Filter out already posted items
    for (const child of data.data.children) {
      const post = child.data;
      
      if (postedIds.has(post.id)) {
        continue; // Skip already posted
      }

      newPosts.push({
        id: post.id,
        title: post.title,
        author: post.author,
        url: `https://www.reddit.com${post.permalink}`,
        created_utc: post.created_utc,
        score: post.score,
        num_comments: post.num_comments,
        subreddit: post.subreddit_name_prefixed
      });

      postedIds.add(post.id);
    }

    // Save results
    if (newPosts.length > 0) {
      await savePostedIds(postedIds);
      await saveOutput(newPosts);
      console.log(`\n✅ Found and saved ${newPosts.length} new posts`);
    } else {
      console.log('\n📭 No new posts found');
    }

    return newPosts;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return [];
  }
}

// Run if called directly
if (require.main === module) {
  const keyword = process.argv[2] || 'slack';
  fetchRedditPosts(keyword);
}

module.exports = { fetchRedditPosts };