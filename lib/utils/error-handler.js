/**
 * Standardized response utilities for API consistency
 */

const logger = require('../logger');

/**
 * Standard API response structure
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the operation was successful
 * @property {*} [data] - Response data (for successful responses)
 * @property {string} [error] - Error message (for failed responses)
 * @property {string} [message] - Human-readable message
 * @property {Object} [meta] - Additional metadata (pagination, timestamps, etc.)
 * @property {Object} [details] - Additional details for debugging
 */

/**
 * Send a standardized success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {Object} options - Additional options
 * @param {number} options.status - HTTP status code (default: 200)
 * @param {string} options.message - Success message
 * @param {Object} options.meta - Metadata (pagination, timestamps, etc.)
 */
function success(res, data = null, options = {}) {
  const { status = 200, message, meta } = options;
  
  const response = {
    success: true,
    data
  };
  
  if (message) {
    response.message = message;
  }
  
  if (meta) {
    response.meta = meta;
  }
  
  return res.status(status).json(response);
}

/**
 * Send a standardized error response
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 * @param {Object} options - Additional options
 * @param {number} options.status - HTTP status code (default: 500)
 * @param {Object} options.details - Additional error details
 * @param {Object} options.meta - Additional metadata
 */
function error(res, error, options = {}) {
  const { status = 500, details, meta } = options;
  
  const response = {
    success: false,
    error
  };
  
  if (details) {
    response.details = details;
  }
  
  if (meta) {
    response.meta = meta;
  }
  
  return res.status(status).json(response);
}

/**
 * Send method not allowed error response
 * @param {Object} res - Express response object
 * @param {string[]} allowedMethods - Array of allowed HTTP methods
 */
function methodNotAllowed(res, allowedMethods = ['GET']) {
  return error(res, 'Method not allowed', {
    status: 405,
    details: { allowed: allowedMethods }
  });
}

/**
 * Send bad request error for validation failures
 * @param {Object} res - Express response object
 * @param {string|Object} validationError - Validation error message or object
 * @param {Object} options - Additional options
 */
function badRequest(res, validationError, options = {}) {
  let errorMessage = 'Bad request';
  let details = {};
  
  if (typeof validationError === 'string') {
    errorMessage = validationError;
  } else if (Array.isArray(validationError)) {
    // Handle missing fields format
    errorMessage = 'Missing required fields';
    details.missing = validationError;
  } else if (typeof validationError === 'object') {
    // Handle validation object
    errorMessage = validationError.message || 'Validation failed';
    details = { ...validationError };
    delete details.message;
  }
  
  return error(res, errorMessage, {
    status: 400,
    details: { ...details, ...options.details },
    meta: options.meta
  });
}

/**
 * Send unauthorized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, { status: 401 });
}

/**
 * Send forbidden error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function forbidden(res, message = 'Forbidden') {
  return error(res, message, { status: 403 });
}

/**
 * Send not found error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function notFound(res, message = 'Resource not found') {
  return error(res, message, { status: 404 });
}

/**
 * Send conflict error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
function conflict(res, message = 'Resource conflict') {
  return error(res, message, { status: 409 });
}

/**
 * Send internal server error response
 * @param {Object} res - Express response object
 * @param {Error|string} err - Error object or message
 * @param {Object} options - Additional options
 * @param {string} options.context - Context for the error (e.g., 'Failed to fetch posts')
 * @param {string} options.hint - Helpful hint for resolving the error
 * @param {Object} options.details - Additional error details
 */
function serverError(res, err, options = {}) {
  const errorMessage = err instanceof Error ? err.message : err;
  const context = options.context || 'Internal server error';
  
  // Log the error with proper logging
  logger.error(context, { 
    error: errorMessage, 
    stack: err instanceof Error ? err.stack : undefined,
    context: options.context,
    details: options.details 
  });
  
  const details = { ...options.details };
  
  if (options.hint) {
    details.hint = options.hint;
  }
  
  // Don't expose sensitive error details in production
  if (process.env.NODE_ENV === 'production') {
    delete details.stack;
  } else if (err instanceof Error && err.stack) {
    details.stack = err.stack;
  }
  
  return error(res, context, {
    status: 500,
    details: Object.keys(details).length > 0 ? details : undefined
  });
}

/**
 * Send generic error response (deprecated - use specific error functions)
 * @param {Object} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {Object} additionalData - Additional data to include in response
 */
function genericError(res, status, message, additionalData = {}) {
  return error(res, message, {
    status,
    details: additionalData
  });
}

/**
 * Validation utilities
 */
const validation = {
  /**
   * Validate required fields in request body
   * @param {Object} body - Request body
   * @param {string[]} requiredFields - Array of required field names
   * @returns {Object|null} Validation error object or null if valid
   */
  validateRequired(body, requiredFields) {
    const missing = [];
    const invalid = [];
    
    for (const field of requiredFields) {
      if (!(field in body)) {
        missing.push(field);
      } else if (body[field] === null || body[field] === undefined || body[field] === '') {
        invalid.push(field);
      }
    }
    
    if (missing.length > 0 || invalid.length > 0) {
      const details = {};
      if (missing.length > 0) details.missing = missing;
      if (invalid.length > 0) details.invalid = invalid;
      
      return {
        message: 'Required field validation failed',
        ...details
      };
    }
    
    return null;
  },
  
  /**
   * Validate field types
   * @param {Object} body - Request body
   * @param {Object} typeMap - Object mapping field names to expected types
   * @returns {Object|null} Validation error object or null if valid
   */
  validateTypes(body, typeMap) {
    const invalid = [];
    
    for (const [field, expectedType] of Object.entries(typeMap)) {
      if (field in body) {
        const value = body[field];
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        
        if (actualType !== expectedType) {
          invalid.push({ field, expected: expectedType, actual: actualType });
        }
      }
    }
    
    if (invalid.length > 0) {
      return {
        message: 'Type validation failed',
        invalid
      };
    }
    
    return null;
  },
  
  /**
   * Combined validation helper
   * @param {Object} body - Request body
   * @param {string[]} requiredFields - Required fields
   * @param {Object} typeMap - Type validation map
   * @returns {Object|null} Validation error object or null if valid
   */
  validate(body, requiredFields = [], typeMap = {}) {
    const requiredError = this.validateRequired(body, requiredFields);
    if (requiredError) return requiredError;
    
    const typeError = this.validateTypes(body, typeMap);
    if (typeError) return typeError;
    
    return null;
  }
};

module.exports = {
  // New standardized response functions
  success,
  error,
  
  // Specific error responses
  methodNotAllowed,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
  
  // Validation utilities
  validation,
  
  // Legacy support (deprecated)
  genericError
};