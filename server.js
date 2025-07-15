const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { serverError } = require('./lib/utils/error-handler');

const app = express();
const PORT = process.env.PORT || 3000;

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
    console.error(`Error in ${functionPath}:`, error);
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
  console.log(`🚀 Development server running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from /public`);
  console.log(`⚡ API routes available at /api/*`);
});