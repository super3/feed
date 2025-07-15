/**
 * Standardized error handling utilities for API responses
 */

/**
 * Send method not allowed error response
 * @param {Object} res - Express response object
 * @param {string[]} allowedMethods - Array of allowed HTTP methods
 */
function methodNotAllowed(res, allowedMethods = ['GET']) {
  return res.status(405).json({ 
    error: 'Method not allowed',
    allowed: allowedMethods 
  });
}

/**
 * Send bad request error for missing required fields
 * @param {Object} res - Express response object
 * @param {string|string[]} missingFields - Missing field name(s)
 */
function badRequest(res, missingFields) {
  const fields = Array.isArray(missingFields) ? missingFields : [missingFields];
  return res.status(400).json({ 
    error: 'Missing required fields',
    missing: fields
  });
}

/**
 * Send internal server error response
 * @param {Object} res - Express response object
 * @param {Error|string} error - Error object or message
 * @param {Object} options - Additional options
 * @param {string} options.context - Context for the error (e.g., 'Failed to fetch posts')
 * @param {string} options.hint - Helpful hint for resolving the error
 * @param {Object} options.details - Additional error details
 */
function serverError(res, error, options = {}) {
  const errorMessage = error instanceof Error ? error.message : error;
  
  // Log the error (replace with proper logging in the future)
  console.error(options.context || 'Server error:', error);
  
  const response = {
    error: options.context || 'Internal server error',
    message: errorMessage
  };
  
  if (options.hint) {
    response.hint = options.hint;
  }
  
  if (options.details) {
    response.details = options.details;
  }
  
  return res.status(500).json(response);
}

/**
 * Send generic error response
 * @param {Object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {Object} additionalData - Additional data to include in response
 */
function genericError(res, status, message, additionalData = {}) {
  return res.status(status).json({
    error: message,
    ...additionalData
  });
}

module.exports = {
  methodNotAllowed,
  badRequest,
  serverError,
  genericError
};