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
const filterByContextBtn = document.getElementById('filter-by-context-btn');
const contextInput = document.getElementById('context-input');
const clearFilterBtn = document.getElementById('clear-filter-btn');

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
  filterByContextBtn.addEventListener('click', filterByContext);
  clearFilterBtn.addEventListener('click', clearContextFilter);
  contextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') filterByContext();
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
    
    // Update the title now that we have keyword context information
    const postsTitle = document.querySelector('.posts-section h2');
    if (postsTitle && currentFilter) {
      const keywordObj = keywords.find(k => 
        (typeof k === 'string' ? k : k.keyword) === currentFilter
      );
      const context = keywordObj && typeof keywordObj === 'object' ? keywordObj.context : null;
      
      postsTitle.textContent = context 
        ? `Posts mentioning "${currentFilter}" (${context})`
        : `Posts mentioning "${currentFilter}"`;
    }
  } catch (error) {
    console.error('Error loading keywords:', error);
  }
}

// Add new keyword
async function addKeyword() {
  const keyword = keywordInput.value.trim();
  const context = contextInput.value.trim();
  if (!keyword) return;
  
  try {
    const response = await fetch('/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, context })
    });
    
    if (response.ok) {
      keywordInput.value = '';
      contextInput.value = '';
      await loadKeywords();
      // If the new keyword becomes the current filter, reload posts to update the title
      if (currentFilter === keyword) {
        await loadPosts();
      }
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
  keywordsList.innerHTML = keywords.map(k => {
    const keywordText = typeof k === 'string' ? k : k.keyword;
    const keywordContext = typeof k === 'object' ? k.context : null;
    return `
      <div class="keyword-tag ${currentFilter === keywordText ? 'active' : ''}" 
           onclick="filterByKeyword('${keywordText}')" 
           style="cursor: pointer;"
           data-context="${keywordContext || ''}">
        ${keywordText}
        <button class="btn btn-danger" onclick="event.stopPropagation(); deleteKeyword('${keywordText}')">×</button>
      </div>
    `;
  }).join('');
  
  // Add "All" tag at the beginning
  keywordsList.innerHTML = `
    <div class="keyword-tag keyword-tag-all ${currentFilter === '' ? 'active' : ''}" onclick="filterByKeyword('')" style="cursor: pointer;">
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
    
    // Check if any posts have filter information
    const hasFilteredPosts = posts.some(post => post.filterContext && post.isRelevant !== undefined);
    
    if (hasFilteredPosts) {
      displayPostsWithFilter();
    } else {
      displayPosts();
    }
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
    if (currentFilter) {
      // Find the keyword object to get its context
      const keywordObj = keywords.find(k => 
        (typeof k === 'string' ? k : k.keyword) === currentFilter
      );
      const context = keywordObj && typeof keywordObj === 'object' ? keywordObj.context : null;
      
      postsTitle.textContent = context 
        ? `Posts mentioning "${currentFilter}" (${context})`
        : `Posts mentioning "${currentFilter}"`;
    } else {
      postsTitle.textContent = 'All posts';
    }
  }
  
  // Show/hide filter buttons based on whether we have a keyword filter
  if (currentFilter) {
    // Count unfiltered posts
    const unfilteredCount = posts.filter(post => !post.filterContext || post.isRelevant === undefined).length;
    filterByContextBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
      </svg>
      Filter${unfilteredCount > 0 ? ` (${unfilteredCount})` : ''}
    `;
    filterByContextBtn.style.display = 'inline-flex';
  } else {
    filterByContextBtn.style.display = 'none';
    clearFilterBtn.style.display = 'none';
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

// Direct filter by context (no panel needed)
function filterByContext() {
  applyContextFilter();
}

// Apply context filter
async function applyContextFilter() {
  let context = contextInput.value.trim();
  if (!context) {
    context = 'the note-taking app';
    contextInput.value = context; // Show the default in the input
  }
  
  contextFilter = context;
  
  // Filter status box removed - no longer needed
  
  // Add filtering class only to unfiltered posts (not already relevant or filtered-out)
  const postCards = document.querySelectorAll('.post-card');
  postCards.forEach(card => {
    // Only add filtering class if the post hasn't been filtered yet
    if (!card.classList.contains('relevant') && !card.classList.contains('filtered-out')) {
      card.classList.add('filtering');
    }
  });
  
  // Update title immediately (will be updated with count later)
  const postsTitle = document.querySelector('.posts-section h2');
  if (postsTitle) {
    if (currentFilter) {
      // Find the keyword object to get its stored context
      const keywordObj = keywords.find(k => 
        (typeof k === 'string' ? k : k.keyword) === currentFilter
      );
      const storedContext = keywordObj && typeof keywordObj === 'object' ? keywordObj.context : null;
      
      // Only show filter context if it's different from stored context
      if (storedContext && storedContext !== context) {
        postsTitle.textContent = `Posts about ${currentFilter} (${storedContext}) - filtering by "${context}"`;
      } else {
        postsTitle.textContent = `Posts about ${currentFilter} (${context})`;
      }
    } else {
      postsTitle.textContent = `Posts - filtering by "${context}"`;
    }
  }
  
  let relevantCount = 0;
  let processedCount = 0;
  let skippedCount = 0;
  
  try {
    // Get all post IDs
    const postIds = posts.map(p => p.id);
    
    // Process posts one by one
    for (let i = 0; i < postIds.length; i++) {
      const postId = postIds[i];
      const post = posts.find(p => p.id === postId);
      const postIndex = posts.findIndex(p => p.id === postId);
      const card = postCards[postIndex];
      
      if (!post || !card) continue;
      
      // Skip if already filtered (has filterContext and isRelevant is set)
      if (post.filterContext && post.isRelevant !== undefined) {
        skippedCount++;
        if (post.isRelevant) relevantCount++;
        continue;
      }
      
      try {
        // Call API for individual post
        const response = await fetch('/api/filter-context-individual', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            keyword: currentFilter,
            context: context,
            postId: postId
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.hint || error.error || 'Failed to filter post');
        }
        
        const result = await response.json();
        
        // Remove filtering class and apply result immediately
        card.classList.remove('filtering');
        
        if (result.error) {
          // Individual post error - treat as not relevant
          card.classList.add('filtered-out');
        } else if (result.relevant) {
          card.classList.add('relevant');
          relevantCount++;
        } else {
          card.classList.add('filtered-out');
        }
        
        // Add reasoning to the card
        if (result.reasoning) {
          addReasoningToCard(card, result.reasoning);
        }
        
        // Update the post object with filter info
        post.filterContext = context;
        post.isRelevant = result.relevant;
        post.filterReason = result.reasoning;
        
        processedCount++;
        
        // Update button count dynamically
        const remainingUnfiltered = posts.filter(post => !post.filterContext || post.isRelevant === undefined).length;
        filterByContextBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
          </svg>
          Filter${remainingUnfiltered > 0 ? ` (${remainingUnfiltered})` : ''}
        `;
        
      } catch (error) {
        console.error(`Error filtering post ${postId}:`, error);
        // On error, mark as filtered out
        card.classList.remove('filtering');
        card.classList.add('filtered-out');
        processedCount++;
      }
    }
    
    // Final status update - update the title instead
    const totalFiltered = processedCount + skippedCount;
    const postsTitle = document.querySelector('.posts-section h2');
    if (postsTitle) {
      if (currentFilter) {
        // Find the keyword object to get its stored context
        const keywordObj = keywords.find(k => 
          (typeof k === 'string' ? k : k.keyword) === currentFilter
        );
        const storedContext = keywordObj && typeof keywordObj === 'object' ? keywordObj.context : null;
        
        // Only show filter context if it's different from stored context
        if (storedContext && storedContext !== context) {
          postsTitle.textContent = `Posts about ${currentFilter} (${storedContext}) - filtering by "${context}" - ${relevantCount} of ${totalFiltered} relevant`;
        } else {
          postsTitle.textContent = `Posts about ${currentFilter} (${context}) - ${relevantCount} of ${totalFiltered} relevant`;
        }
      } else {
        postsTitle.textContent = `Posts - filtering by "${context}" - ${relevantCount} of ${totalFiltered} relevant`;
      }
    }
    
    // Filter status box removed - no longer needed
    
    // Show clear button
    clearFilterBtn.style.display = 'inline-flex';
    
    // Reload posts to ensure storage is in sync
    setTimeout(() => loadPosts(), 100);
    
  } catch (error) {
    console.error('Context filtering error:', error);
    
    // Remove filtering state from remaining posts
    document.querySelectorAll('.post-card.filtering').forEach(card => {
      card.classList.remove('filtering');
    });
    
    // If it's likely LM Studio is not running, provide helpful message
    if (error.message.includes('LM Studio')) {
      alert('Unable to connect to LM Studio. Please ensure it is running on http://localhost:1234');
    } else {
      alert(`Filtering failed: ${error.message}`);
    }
  }
}

// Add reasoning to a post card
function addReasoningToCard(card, reasoning) {
  // Remove any existing reasoning element
  const existingReasoning = card.querySelector('.ai-reasoning');
  if (existingReasoning) {
    existingReasoning.remove();
  }
  
  // Create collapsible reasoning element
  const reasoningEl = document.createElement('details');
  reasoningEl.className = 'ai-reasoning';
  
  const summary = document.createElement('summary');
  summary.textContent = '🤖 AI Reasoning';
  reasoningEl.appendChild(summary);
  
  const content = document.createElement('div');
  content.className = 'reasoning-content';
  
  // Format the reasoning text, handling potential thinking tags
  const formattedReasoning = formatReasoning(reasoning);
  content.innerHTML = formattedReasoning;
  
  reasoningEl.appendChild(content);
  
  // Insert after the post content
  const postContent = card.querySelector('.post-content');
  if (postContent) {
    postContent.appendChild(reasoningEl);
  }
}

// Format AI reasoning for display
function formatReasoning(reasoning) {
  // Check if it contains thinking tags
  if (reasoning.includes('<think>')) {
    // Extract thinking content
    const thinkMatch = reasoning.match(/<think>([\s\S]*?)<\/think>/);
    const answerMatch = reasoning.match(/<\/think>\s*(.+?)$/);
    
    let formatted = '';
    if (thinkMatch && thinkMatch[1]) {
      formatted += `<div class="thinking-section"><strong>Thinking:</strong><br>${escapeHtml(thinkMatch[1].trim())}</div>`;
    }
    if (answerMatch && answerMatch[1]) {
      formatted += `<div class="answer-section"><strong>Answer:</strong> ${escapeHtml(answerMatch[1].trim())}</div>`;
    }
    return formatted || `<div>${escapeHtml(reasoning)}</div>`;
  } else {
    // No thinking tags, just display as is
    return `<div>${escapeHtml(reasoning)}</div>`;
  }
}

// Clear context filter
async function clearContextFilter() {
  contextFilter = '';
  contextInput.value = '';
  
  try {
    // Get all post IDs that have filter info
    const filteredPostIds = posts.filter(p => p.filterContext).map(p => p.id);
    
    if (filteredPostIds.length > 0) {
      // Call API to clear filter info from posts
      const response = await fetch('/api/clear-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: currentFilter,
          postIds: filteredPostIds
        })
      });
      
      if (response.ok) {
        // Hide clear button
        clearFilterBtn.style.display = 'none';
        // Reload posts to get updated state
        await loadPosts();
      }
    } else {
      // Hide clear button
      clearFilterBtn.style.display = 'none';
      // Just refresh the display
      displayPosts();
    }
  } catch (error) {
    console.error('Error clearing filter:', error);
    alert('Error clearing filter');
  }
}

// Display posts with existing filter applied
function displayPostsWithFilter() {
  // Find the most recent filter context
  const filteredPosts = posts.filter(post => post.filterContext && post.isRelevant !== undefined);
  if (filteredPosts.length === 0) {
    displayPosts();
    return;
  }
  
  // Get the context from the first filtered post
  const context = filteredPosts[0].filterContext;
  contextFilter = context;
  
  // Count relevant posts
  const relevantCount = posts.filter(post => post.isRelevant === true).length;
  const totalFiltered = posts.filter(post => post.isRelevant !== undefined).length;
  
  // Update the section title with count
  const postsTitle = document.querySelector('.posts-section h2');
  if (postsTitle) {
    if (currentFilter) {
      // Find the keyword object to get its stored context
      const keywordObj = keywords.find(k => 
        (typeof k === 'string' ? k : k.keyword) === currentFilter
      );
      const storedContext = keywordObj && typeof keywordObj === 'object' ? keywordObj.context : null;
      
      // Only show filter context if it's different from stored context
      if (storedContext && storedContext !== context) {
        postsTitle.textContent = `Posts about ${currentFilter} (${storedContext}) - filtering by "${context}" - ${relevantCount} of ${totalFiltered} relevant`;
      } else {
        postsTitle.textContent = `Posts about ${currentFilter} (${context}) - ${relevantCount} of ${totalFiltered} relevant`;
      }
    } else {
      postsTitle.textContent = `Posts - filtering by "${context}" - ${relevantCount} of ${totalFiltered} relevant`;
    }
  }
  
  // Show filter buttons
  // Count unfiltered posts
  const unfilteredCount = posts.filter(post => !post.filterContext || post.isRelevant === undefined).length;
  filterByContextBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
    </svg>
    Filter${unfilteredCount > 0 ? ` (${unfilteredCount})` : ''}
  `;
  filterByContextBtn.style.display = 'inline-flex';
  clearFilterBtn.style.display = 'inline-flex';
  
  // Set the context in the input field
  contextInput.value = context;
  
  // Filter status box already removed from HTML
  
  // Display all posts with appropriate filtering
  postsContainer.innerHTML = posts.map((post, index) => {
    const filterClass = post.isRelevant === true ? 'relevant' : 
                       post.isRelevant === false ? 'filtered-out' : '';
    
    return `
      <div class="post-card ${filterClass}">
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
            ${post.filterReason ? createReasoningElement(post.filterReason) : ''}
          </div>
        </details>
      </div>
    `;
  }).join('');
  
  // Add event listeners to prevent button clicks from toggling details
  document.querySelectorAll('.reddit-link-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });
}

// Create reasoning element HTML
function createReasoningElement(reasoning) {
  const formattedReasoning = formatReasoning(reasoning);
  return `
    <details class="ai-reasoning">
      <summary>🤖 AI Reasoning</summary>
      <div class="reasoning-content">
        ${formattedReasoning}
      </div>
    </details>
  `;
}