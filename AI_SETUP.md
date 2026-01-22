# How to Enable AI Analysis

## Overview
The AI analysis feature uses OpenAI's GPT-4o-mini model to intelligently extract and categorize file names from documents. It provides better accuracy than regex-based extraction, especially for complex documents.

## Setup Instructions

### 1. Get an OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the API key (starts with `sk-`)

### 2. Add the API Key to Your Environment

#### For Local Development:
1. Create a file named `.env.local` in the project root
2. Add the following line:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```
3. Restart your development server (`npm run dev`)

#### For Vercel Deployment:
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-`)
   - **Environment**: Production, Preview, and Development (select all)
4. Redeploy your application

### 3. Verify AI is Available
1. After adding the API key, the app will automatically detect it
2. You'll see an "AI ON/OFF" toggle in the header (top right)
3. The toggle will be enabled if AI is available

## How to Use AI Analysis

### Method 1: Toggle Before Upload
1. Before uploading a file, toggle the **AI** switch in the header to **ON** (purple/gradient)
2. Upload your document
3. The analysis will use AI instead of regex

### Method 2: Re-analyze with AI
1. Upload a document (it will use regex by default)
2. After results appear, click the **"AI"** button in the results toolbar
3. The document will be re-analyzed using AI

## What AI Analysis Provides

- **Better Accuracy**: Understands context and document structure
- **Confidence Scores**: Each extracted file name gets a confidence level (high/medium/low)
- **Document Type Detection**: Identifies what type of document it is (e.g., "File Index", "Audit Report")
- **Smart Pattern Grouping**: Creates meaningful pattern descriptions
- **Summary**: Provides a brief summary of findings

## Cost Considerations

- AI analysis uses OpenAI's GPT-4o-mini model
- Each analysis request consumes API credits
- The app is rate-limited to 5 AI requests per minute to control costs
- Regex analysis is free and unlimited

## Troubleshooting

### AI Toggle is Disabled/Grayed Out
- **Cause**: No API key configured
- **Solution**: Add `OPENAI_API_KEY` to your environment variables

### "No API key" Message
- **Cause**: API key not found or invalid
- **Solution**: 
  1. Verify the key is correctly set in `.env.local` (local) or Vercel (production)
  2. Ensure the key starts with `sk-` or `sk-proj-`
  3. Restart the server after adding the key

### AI Analysis Fails
- The app will automatically fall back to regex analysis
- Check the browser console for detailed error messages
- Verify your OpenAI account has credits available

## Testing AI Setup

You can test if AI is working by visiting:
- Local: `http://localhost:3000/api/test-ai`
- Production: `https://your-domain.com/api/test-ai`

This endpoint will test the AI connection and show you the results.

