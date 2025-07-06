// State management
let keywords = [];
let posts = [];
let currentFilter = '';

// DOM elements
const keywordInput = document.getElementById('keyword-input');
const addKeywordBtn = document.getElementById('add-keyword-btn');
const keywordsList = document.getElementById('keywords-list');
const keywordFilter = document.getElementById('keyword-filter');
const fetchBtn = document.getElementById('fetch-btn');
const postsContainer = document.getElementById('posts-container');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadKeywords();
  loadPosts();
  
  // Event listeners
  addKeywordBtn.addEventListener('click', addKeyword);
  keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addKeyword();
  });
  
  keywordFilter.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    updateURL();
    displayPosts();
  });
  
  fetchBtn.addEventListener('click', fetchNewPosts);
  
  // Check URL for keyword filter
  const urlParams = new URLSearchParams(window.location.search);
  const keywordParam = urlParams.get('keyword');
  if (keywordParam) {
    currentFilter = keywordParam;
  }
});

// Load keywords from API
async function loadKeywords() {
  try {
    const response = await fetch('/api/keywords');
    const data = await response.json();
    keywords = data.keywords || [];
    updateKeywordsDisplay();
    updateFilterOptions();
  } catch (error) {
    console.error('Error loading keywords:', error);
  }
}

// Add new keyword
async function addKeyword() {
  const keyword = keywordInput.value.trim();
  if (!keyword) return;
  
  try {
    const response = await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword })
    });
    
    if (response.ok) {
      keywordInput.value = '';
      await loadKeywords();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to add keyword');
    }
  } catch (error) {
    console.error('Error adding keyword:', error);
  }
}

// Delete keyword
async function deleteKeyword(keyword) {
  try {
    const response = await fetch(`/api/keywords?keyword=${encodeURIComponent(keyword)}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await loadKeywords();
      if (currentFilter === keyword) {
        currentFilter = '';
        keywordFilter.value = '';
        updateURL();
        loadPosts();
      }
    }
  } catch (error) {
    console.error('Error deleting keyword:', error);
  }
}

// Update keywords display
function updateKeywordsDisplay() {
  keywordsList.innerHTML = keywords.map(keyword => `
    <div class="keyword-tag">
      ${keyword}
      <button class="btn btn-danger" onclick="deleteKeyword('${keyword}')">×</button>
    </div>
  `).join('');
}

// Update filter options
function updateFilterOptions() {
  const currentValue = keywordFilter.value;
  keywordFilter.innerHTML = '<option value="">All Keywords</option>';
  
  keywords.forEach(keyword => {
    const option = document.createElement('option');
    option.value = keyword;
    option.textContent = keyword;
    if (keyword === currentFilter) {
      option.selected = true;
    }
    keywordFilter.appendChild(option);
  });
}

// Load posts from API
async function loadPosts() {
  try {
    postsContainer.innerHTML = '<p class="loading">Loading posts...</p>';
    
    const url = currentFilter 
      ? `/api/posts?keyword=${encodeURIComponent(currentFilter)}`
      : '/api/posts';
      
    const response = await fetch(url);
    const data = await response.json();
    posts = data.posts || [];
    displayPosts();
  } catch (error) {
    console.error('Error loading posts:', error);
    postsContainer.innerHTML = '<p class="error">Failed to load posts</p>';
  }
}

// Display posts
function displayPosts() {
  if (posts.length === 0) {
    postsContainer.innerHTML = '<p class="loading">No posts found</p>';
    return;
  }
  
  postsContainer.innerHTML = posts.map(post => `
    <div class="post-card">
      <h3 class="post-title">
        <a href="${post.url}" target="_blank" rel="noopener noreferrer">${post.title}</a>
      </h3>
      <div class="post-meta">
        <span>📍 ${post.subreddit}</span>
        <span>👤 ${post.author}</span>
        <span>⬆️ ${post.score}</span>
        <span>💬 ${post.num_comments}</span>
        <span>🕒 ${new Date(post.created).toLocaleString()}</span>
        <span class="keyword-badge">${post.keyword}</span>
      </div>
    </div>
  `).join('');
}

// Fetch new posts
async function fetchNewPosts() {
  try {
    fetchBtn.disabled = true;
    fetchBtn.textContent = 'Fetching...';
    
    const response = await fetch('/api/fetch-reddit', { method: 'POST' });
    const data = await response.json();
    
    // Count total new posts
    let totalNew = 0;
    Object.values(data.results).forEach(result => {
      if (result.success) totalNew += result.count;
    });
    
    alert(`Fetched ${totalNew} new posts`);
    await loadPosts();
  } catch (error) {
    console.error('Error fetching posts:', error);
    alert('Failed to fetch new posts');
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.textContent = 'Fetch New Posts';
  }
}

// Update URL with filter
function updateURL() {
  const url = new URL(window.location);
  if (currentFilter) {
    url.searchParams.set('keyword', currentFilter);
  } else {
    url.searchParams.delete('keyword');
  }
  window.history.pushState({}, '', url);
}