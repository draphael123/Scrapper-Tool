/**
 * API Documentation endpoint (OpenAPI/Swagger)
 */

import { NextResponse } from 'next/server';

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'FileScope API',
    version: '0.1.0',
    description: 'API for extracting and analyzing file names from documents',
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
      description: 'API Server',
    },
  ],
  paths: {
    '/api/analyze': {
      get: {
        summary: 'Check AI availability',
        responses: {
          '200': {
            description: 'AI availability status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    aiAvailable: { type: 'boolean' },
                    requestId: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Analyze a single document',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'PDF or DOCX file to analyze',
                  },
                  useAI: {
                    type: 'boolean',
                    description: 'Whether to use AI analysis',
                  },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Analysis results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    fileName: { type: 'string' },
                    fileType: { type: 'string' },
                    analysis: { type: 'object' },
                    requestId: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': { description: 'Bad request' },
          '413': { description: 'File too large' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },
    '/api/analyze-batch': {
      post: {
        summary: 'Analyze multiple documents',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                  },
                  useAI: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Batch analysis results' },
          '400': { description: 'Bad request' },
          '429': { description: 'Rate limit exceeded' },
        },
      },
    },
    '/api/extract-zip': {
      post: {
        summary: 'Extract files from ZIP archive',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  includeSubfolders: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Extracted files' },
          '400': { description: 'Bad request' },
        },
      },
    },
    '/api/health': {
      get: {
        summary: 'Health check endpoint',
        responses: {
          '200': { description: 'Service is healthy' },
          '503': { description: 'Service is unhealthy' },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(openApiSpec);
}

