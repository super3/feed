/**
 * Parser for LLM responses, particularly for YES/NO classification
 */

const logger = require('../logger');

/**
 * Parse a YES/NO response from LLM output
 * @param {string} fullResponse - The complete LLM response
 * @param {string} postId - Post ID for logging purposes
 * @returns {Object} - { isRelevant: boolean, reasoning: string }
 */
function parseYesNoResponse(fullResponse, postId = '') {
  // Log the raw response for debugging
  logger.debug('Raw LLM response received', { postId, response: fullResponse });
  
  // Default to NOT showing the post (more conservative)
  let isRelevant = false;
  
  // Look for "Answer: YES/NO" pattern first (most reliable)
  const answerMatch = fullResponse.match(/Answer:\s*(YES|NO)/i);
  
  if (answerMatch) {
    // If we found "Answer: YES/NO", use that
    isRelevant = answerMatch[1].toUpperCase() === 'YES';
    logger.debug('Found answer pattern in LLM response', { postId, answer: answerMatch[1] });
  } else {
    // Look for standalone YES or NO at the end of the response or as a single line
    // This regex looks for YES or NO that appears alone on a line or at the very end
    const standaloneMatch = fullResponse.match(/(?:^|\n)\s*(YES|NO)\s*(?:\n|$)/i);
    
    if (standaloneMatch) {
      isRelevant = standaloneMatch[1].toUpperCase() === 'YES';
      logger.debug('Found standalone answer in LLM response', { postId, answer: standaloneMatch[1] });
    } else {
      // Check if response appears truncated (doesn't end with punctuation or YES/NO)
      const lastChar = fullResponse.trim().slice(-1);
      const appearsTruncated = !['!', '.', '?', 'S', 'O'].includes(lastChar.toUpperCase());
      
      // As a last resort, look for the LAST occurrence of YES or NO in the response
      // This helps when the thinking contains phrases like "I can't say yes" but concludes with NO
      const allYesNo = [...fullResponse.matchAll(/\b(YES|NO)\b/gi)];
      
      if (allYesNo.length > 0) {
        // Use the LAST occurrence
        const lastMatch = allYesNo[allYesNo.length - 1][1];
        isRelevant = lastMatch.toUpperCase() === 'YES';
        logger.debug('Using last YES/NO found in response', { postId, answer: lastMatch });
      } else {
        // If response appears truncated, add a note
        if (appearsTruncated) {
          logger.warn('LLM response appears truncated', { postId, response: fullResponse });
          return {
            isRelevant: false,
            reasoning: fullResponse + '\n\n[Response appears truncated - defaulting to NO]'
          };
        }
        
        logger.warn('Ambiguous LLM response received', { postId, response: fullResponse });
        // Default to false if we can't find any YES/NO
        isRelevant = false;
      }
    }
  }
  
  return {
    isRelevant,
    reasoning: fullResponse
  };
}

/**
 * Clean content by removing HTML entities
 * @param {string} content - Content to clean
 * @param {number} maxLength - Maximum length (default 2000)
 * @returns {string} - Cleaned content
 */
function cleanHtmlEntities(content, maxLength = 2000) {
  return (content || 'No text content')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .substring(0, maxLength);
}

/**
 * Build prompt for content analysis
 * @param {string} title - Post title
 * @param {string} content - Post content (already cleaned)
 * @param {string} keyword - Keyword to search for
 * @param {string} context - Context to consider
 * @returns {string} - Formatted prompt
 */
function buildAnalysisPrompt(title, content, keyword, context) {
  return `Analyze this Reddit post:
Title: ${title}
Content: ${content}

Question: Does this post mention or discuss "${keyword}" in the context of "${context}"?

Reply with only YES or NO.`;
}

module.exports = {
  parseYesNoResponse,
  cleanHtmlEntities,
  buildAnalysisPrompt
};