const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { serverError } = require('./lib/utils/error-handler');
const config = require('./lib/config');
const logger = require('./lib/logger');

// Load environment variables
require('dotenv').config({ path: '.env.development.local' });

const app = express();
const PORT = config.environment.port;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Function to handle serverless function requests
async function handleServerlessFunction(functionPath, req, res) {
  try {
    // Clear require cache for hot reloading
    delete require.cache[require.resolve(functionPath)];
    
    const handler = require(functionPath);
    
    // Simulate Vercel's request/response objects
    const mockReq = {
      method: req.method,
      query: req.query,
      body: req.body,
      headers: req.headers,
      url: req.url
    };
    
    const mockRes = {
      statusCode: 200,
      headers: {},
      status: (code) => {
        mockRes.statusCode = code;
        return mockRes;
      },
      setHeader: (key, value) => {
        mockRes.headers[key] = value;
        return mockRes;
      },
      json: (data) => {
        res.status(mockRes.statusCode);
        Object.entries(mockRes.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.json(data);
      },
      send: (data) => {
        res.status(mockRes.statusCode);
        Object.entries(mockRes.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.send(data);
      },
      end: () => {
        res.status(mockRes.statusCode);
        Object.entries(mockRes.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        res.end();
      },
      write: (data) => {
        // For streaming responses, set headers if not already set
        if (!res.headersSent) {
          Object.entries(mockRes.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
          });
        }
        res.write(data);
      }
    };
    
    await handler(mockReq, mockRes);
  } catch (error) {
    logger.error('Error in API route', { functionPath, error: error.message, stack: error.stack });
    serverError(res, error, { context: 'API route error' });
  }
}

// Route all /api/* requests to corresponding files in /api directory
app.all('/api/*', async (req, res) => {
  const functionName = req.path.replace('/api/', '');
  const functionPath = path.join(__dirname, 'api', `${functionName}.js`);
  
  try {
    await fs.access(functionPath);
    await handleServerlessFunction(functionPath, req, res);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Function not found' });
    } else {
      serverError(res, error, { context: 'Server startup error' });
    }
  }
});

// Catch-all route for frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  logger.info('Development server started', {
    port: PORT,
    publicDir: '/public',
    apiRoutes: '/api/*',
    url: `http://localhost:${PORT}`
  });
});