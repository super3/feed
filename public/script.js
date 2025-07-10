// State management
let keywords = [];
let posts = [];
let currentFilter = '';
let contextFilter = '';

// DOM elements
const keywordInput = document.getElementById('keyword-input');
const addKeywordBtn = document.getElementById('add-keyword-btn');
const keywordsList = document.getElementById('keywords-list');
const fetchBtn = document.getElementById('fetch-btn');
const postsContainer = document.getElementById('posts-container');
const contextFilterToggle = document.getElementById('context-filter-toggle');
const contextFilterPanel = document.getElementById('context-filter-panel');
const contextInput = document.getElementById('context-input');
const applyFilterBtn = document.getElementById('apply-filter-btn');
const clearFilterBtn = document.getElementById('clear-filter-btn');
const filterStatus = document.getElementById('filter-status');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check URL for keyword filter FIRST
  const urlParams = new URLSearchParams(window.location.search);
  const keywordParam = urlParams.get('keyword');
  if (keywordParam) {
    currentFilter = keywordParam;
  }
  
  // Update title on initial load
  const postsTitle = document.querySelector('.posts-section h2');
  if (postsTitle) {
    postsTitle.textContent = currentFilter ? `Posts mentioning "${currentFilter}"` : 'All posts';
  }
  
  // Now load data with the correct filter
  loadKeywords();
  loadPosts();
  
  // Event listeners
  addKeywordBtn.addEventListener('click', addKeyword);
  keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addKeyword();
  });
  
  fetchBtn.addEventListener('click', fetchNewPosts);
  
  // Context filter event listeners
  contextFilterToggle.addEventListener('click', toggleFilterPanel);
  applyFilterBtn.addEventListener('click', applyContextFilter);
  clearFilterBtn.addEventListener('click', clearContextFilter);
  contextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyContextFilter();
  });
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
    <div class="keyword-tag ${currentFilter === keyword ? 'active' : ''}" onclick="filterByKeyword('${keyword}')" style="cursor: pointer;">
      ${keyword}
      <button class="btn btn-danger" onclick="event.stopPropagation(); deleteKeyword('${keyword}')">×</button>
    </div>
  `).join('');
  
  // Add "All" tag at the beginning
  keywordsList.innerHTML = `
    <div class="keyword-tag ${currentFilter === '' ? 'active' : ''}" onclick="filterByKeyword('')" style="cursor: pointer;">
      All
    </div>
  ` + keywordsList.innerHTML;
}

// Filter by keyword when tag is clicked
function filterByKeyword(keyword) {
  currentFilter = keyword;
  updateURL();
  loadPosts();
  updateKeywordsDisplay();
}

// Update filter options
function updateFilterOptions() {
  // No longer needed since we removed the dropdown
  // Just update the keyword display to show active state
  updateKeywordsDisplay();
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
  // Update the section title based on current filter
  const postsTitle = document.querySelector('.posts-section h2');
  if (postsTitle) {
    postsTitle.textContent = currentFilter ? `Posts mentioning "${currentFilter}"` : 'All posts';
  }
  
  // Show/hide context filter button based on whether we have a keyword filter
  if (currentFilter) {
    contextFilterToggle.style.display = 'inline-flex';
  } else {
    contextFilterToggle.style.display = 'none';
    contextFilterPanel.style.display = 'none';
  }
  
  if (posts.length === 0) {
    postsContainer.innerHTML = '<p class="loading">No posts found</p>';
    return;
  }
  
  postsContainer.innerHTML = posts.map((post, index) => `
    <div class="post-card">
      <a href="${post.url}" target="_blank" rel="noopener noreferrer" class="reddit-link-btn" title="Open in Reddit">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
        </svg>
      </a>
      <details class="post-wrapper">
        <summary class="post-header">
          <h3 class="post-title">${highlightKeyword(escapeHtml(post.title), currentFilter)}</h3>
          <div class="post-meta">
            <span>📍 ${post.subreddit}</span>
            <span>👤 ${post.author}</span>
            <span>⬆️ ${post.score}</span>
            <span>💬 ${post.num_comments}</span>
            <span>🕒 ${new Date(post.created).toLocaleString()}</span>
          </div>
        </summary>
        <div class="post-content">
          ${post.selftext ? `<div class="post-selftext">${highlightKeyword(escapeHtml(post.selftext), currentFilter)}</div>` : '<p><em>No text content (link post)</em></p>'}
        </div>
      </details>
    </div>
  `).join('');
  
  // Add event listeners to prevent button clicks from toggling details
  document.querySelectorAll('.reddit-link-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text.trim();
  return div.innerHTML.replace(/\n/g, '<br>');
}

// Helper function to highlight keywords in text
function highlightKeyword(text, keyword) {
  if (!keyword || !text) return text;
  
  // Escape the keyword for use in regex
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Create regex with case-insensitive flag
  const regex = new RegExp(`(${escapedKeyword})`, 'gi');
  
  // Replace matches with bold text
  return text.replace(regex, '<strong>$1</strong>');
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
    fetchBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 32 32" style="margin-right: 6px; vertical-align: text-bottom;">
        <circle cx="13" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/>
        <path d="M18.5 18.5 L26 26" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>
      Fetch
    `;
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

// Toggle filter panel visibility
function toggleFilterPanel() {
  const isVisible = contextFilterPanel.style.display !== 'none';
  contextFilterPanel.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) {
    contextInput.focus();
  }
}

// Apply context filter
async function applyContextFilter() {
  const context = contextInput.value.trim();
  if (!context) {
    alert('Please enter a context description');
    return;
  }
  
  contextFilter = context;
  
  // Update filter status
  filterStatus.textContent = `Filtering posts about "${currentFilter}" in the context of "${context}"...`;
  
  // Add filtering class to all posts
  document.querySelectorAll('.post-card').forEach(card => {
    card.classList.add('filtering');
  });
  
  // Simulate AI filtering (placeholder for actual implementation)
  setTimeout(() => {
    const postCards = document.querySelectorAll('.post-card');
    let relevantCount = 0;
    
    // For demo purposes, randomly mark some posts as relevant
    postCards.forEach((card, index) => {
      card.classList.remove('filtering');
      
      // Placeholder logic - in real implementation, this would call an AI API
      const isRelevant = Math.random() > 0.5;
      
      if (isRelevant) {
        card.classList.add('relevant');
        relevantCount++;
      } else {
        card.classList.add('filtered-out');
      }
    });
    
    // Update status
    filterStatus.textContent = `Showing ${relevantCount} of ${postCards.length} posts about "${currentFilter}" (${context})`;
    
    // Update title
    const postsTitle = document.querySelector('.posts-section h2');
    if (postsTitle) {
      postsTitle.textContent = `Posts about ${currentFilter} (${context})`;
    }
  }, 1500);
}

// Clear context filter
function clearContextFilter() {
  contextFilter = '';
  contextInput.value = '';
  filterStatus.textContent = '';
  
  // Remove all filter classes
  document.querySelectorAll('.post-card').forEach(card => {
    card.classList.remove('filtering', 'filtered-out', 'relevant');
  });
  
  // Reset title
  const postsTitle = document.querySelector('.posts-section h2');
  if (postsTitle) {
    postsTitle.textContent = `Posts mentioning "${currentFilter}"`;
  }
}