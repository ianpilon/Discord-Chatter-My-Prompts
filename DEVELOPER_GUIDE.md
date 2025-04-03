# Discord Digest Developer Guide

## Overview

Discord Digest is a full-stack web application that connects to Discord servers via a bot, processes messages, and generates AI-powered summaries of conversations. The application presents these summaries in a modern dashboard interface, allowing users to quickly catch up on important discussions.

## Tech Stack

- **Frontend**: React.js with TypeScript, Vite
- **Backend**: Node.js Express API server
- **Data Storage**: Local storage + React Query cache
- **External APIs**: Discord API, OpenAI API
- **Styling**: Tailwind CSS + shadcn/ui
- **Deployment**: Vercel (serverless)

## Getting Started

### Prerequisites

1. Node.js and npm installed
2. Discord bot token with proper permissions
3. OpenAI API key
4. Mailjet API credentials (for email functionality)
5. PostgreSQL database (Neon recommended for serverless)

### Environment Setup

Create a `.env` file with:

```env
NODE_ENV=development
DATABASE_URL=your_postgres_url
DISCORD_BOT_TOKEN=your_discord_token
OPENAI_API_KEY=your_openai_key
MAILJET_API_KEY=your_mailjet_key
MAILJET_SECRET_KEY=your_mailjet_secret
SENDER_EMAIL=your_sender_email
CRON_SECRET=your_cron_secret
```

### Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Access the application at http://localhost:3001

## Architecture

### Directory Structure

```
/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # UI components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utilities and API clients
│   │   └── pages/              # Page components
├── server/
│   ├── index.ts                # Server entry point
│   ├── routes.ts              # API routes
│   ├── discord.ts             # Discord integration
│   ├── openai.ts             # OpenAI integration
│   └── storage.ts            # Data persistence
└── docs/                     # Documentation
```

### Data Flow

1. **Message Retrieval**:
   - User selects channel → API request → Discord API → Frontend display
   - Messages cached via React Query
   - Complete history available with `?all=true` parameter

2. **Analysis Flow**:
   - User initiates analysis
   - Parallel requests for sentiment and JTBD analysis
   - Results cached in localStorage
   - Analysis displayed in slide-out drawer

## Features

### 1. Message Display
- Continuous scrollable message list
- Fixed header with channel info
- Clean message cards with proper spacing
- Variable height messages support

### 2. Analysis Capabilities
- Dual analysis types:
  - Sentiment analysis
  - Jobs to be Done (JTBD) framework
- Results persistence across sessions
- Download analysis as text file
- Educational JTBD framework info

### 3. UI Components
- Server/channel navigation sidebar
- Analysis drawer with backdrop blur
- Loading indicators for analysis
- Toast notifications
- Responsive design

## API Reference

### Discord Integration

\`\`\`typescript
GET /api/servers
Response: { servers: DiscordServer[] }

GET /api/servers/:serverId/channels
Response: { channels: DiscordChannel[] }

GET /api/channels/:channelId/messages
Query: { all?: boolean }
Response: { messages: DiscordMessage[] }
\`\`\`

### Analysis Endpoints

\`\`\`typescript
POST /api/channels/:channelId/analyze-sentiment
Body: { messages: DiscordMessage[] }
Response: {
  analysis: string,
  messagesAnalyzed: number,
  generatedAt: string
}

POST /api/channels/:channelId/analyze-jtbd
Body: { messages: DiscordMessage[] }
Response: {
  analysis: string,
  messagesAnalyzed: number,
  generatedAt: string
}
\`\`\`

## State Management

1. **React Query**:
   - API request caching
   - Loading states
   - Error handling

2. **Local Storage**:
   - Analysis results
   - UI state persistence
   - Session tracking

3. **Component State**:
   - UI interactions
   - Drawer states
   - Current selections

## Deployment

### Vercel Deployment

1. **Environment Setup**:
   - Configure all environment variables in Vercel dashboard
   - Set up Neon database
   - Configure Mailjet for emails

2. **GitHub Actions**:
   - Auto-analysis trigger workflow
   - Hourly schedule configurable
   - Manual trigger option

3. **Serverless Considerations**:
   - No persistent connections
   - Cold start awareness
   - Function timeout limits (1024MB memory)

### Required Repository Secrets

```
ANALYSIS_ENDPOINT=https://your-app.vercel.app/api/cron/auto-analysis
CRON_SECRET=your-secure-token
```

## Troubleshooting

### Common Issues

1. **MIME Type Errors**:
   - Update Content-Type headers in vercel.json
   - Use text/javascript for ES modules

2. **404 API Routes**:
   - Verify correct Vercel directory structure
   - Move API routes to /api directory

3. **Channel Display Issues**:
   - Check server response format
   - Verify channel type handling
   - Debug UI rendering logic

## Recent Updates

1. **UI Improvements**:
   - Continuous message scrolling
   - Analysis drawer implementation
   - Dual analysis buttons

2. **Functionality**:
   - Parallel analysis processing
   - Results persistence
   - Complete message history support

3. **Bug Fixes**:
   - Import syntax updates
   - Type definition improvements
   - Message display fixes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is proprietary and confidential.

---

Last updated: April 2, 2025
