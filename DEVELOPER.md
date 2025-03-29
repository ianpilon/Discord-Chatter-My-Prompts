# Discord Digest Developer Documentation

This documentation provides a comprehensive guide to the Discord Digest application architecture, user flows, data management, and API integration. It's designed to help developers quickly understand the codebase and contribute effectively.

## Table of Contents
- [Architecture Overview](#architecture-overview)
- [Frontend Structure](#frontend-structure)
- [Backend Structure](#backend-structure)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [User Experience Flows](#user-experience-flows)
- [API Reference](#api-reference)
- [Analysis Features](#analysis-features)

## Architecture Overview

Discord Digest is a full-stack web application built with the following technologies:

- **Frontend**: React.js with TypeScript, using Vite as the build tool
- **Backend**: Node.js Express API server
- **Data Storage**: Local storage for UI state persistence, API responses cached with React Query
- **External APIs**: Discord API for message retrieval, OpenAI API for message analysis
- **Styling**: Tailwind CSS with custom theme variables
- **UI Components**: Custom components and shadcn/ui component library

The application follows a client-server architecture where the React frontend communicates with the Express backend via RESTful API endpoints. The backend handles authentication with Discord, message retrieval, and integrates with OpenAI for message analysis.

## Frontend Structure

### Key Directories and Files

```
client/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── analysis-drawer.tsx    # Slide-out drawer for displaying analysis results
│   │   │   ├── sidebar.tsx            # Server and channel navigation sidebar
│   │   │   ├── message-list.tsx       # Scrollable message display component
│   │   │   └── ... (other UI components)
│   ├── hooks/
│   │   ├── use-toast.ts              # Toast notification hook
│   ├── lib/
│   │   ├── api.ts                    # API client functions
│   │   ├── queryClient.ts            # React Query configuration
│   ├── pages/
│   │   ├── dashboard.tsx             # Main application dashboard
│   │   ├── login.tsx                 # Authentication page
│   ├── App.tsx                       # Main application component
│   └── main.tsx                      # Application entry point
```

### Component Hierarchy

- `App`: Root component, handles routing and global state
  - `Dashboard`: Main application container
    - `Sidebar`: Navigation for servers and channels
    - `ActivityHeader`: Top bar with current channel info
    - `DirectMessageFetcher`: Handles message retrieval and display
      - Message Cards: Individual message display
    - `AnalysisDrawer`: Slide-out drawer for analysis results

## Backend Structure

### Key Directories and Files

```
server/
├── index.ts                # Server entry point
├── routes.ts              # API route definitions
├── discord.ts             # Discord API integration
├── openai.ts              # OpenAI API integration
├── scheduler.ts           # Scheduled jobs for periodic tasks
└── storage.ts             # Data persistence module
```

### Server Configuration

The Express server is configured with middleware for:
- CORS support
- Request parsing (JSON, URL-encoded)
- Session management
- Static file serving for the React frontend

## Data Flow

### Message Retrieval and Display

1. User selects a server and channel in the sidebar
2. Frontend makes API request to `/api/channels/:channelId/messages?all=true`
3. Backend retrieves messages from Discord API
4. Messages are returned to frontend
5. React Query caches results for performance
6. `DirectMessageFetcher` component renders messages in a scrollable container

### Analysis Workflow

1. User clicks "Analyze this chatter" button
2. Both sentiment and JTBD analyses start simultaneously:
   - Frontend calls `/api/channels/:channelId/analyze-sentiment`
   - Frontend calls `/api/channels/:channelId/analyze-jtbd`
3. Backend processes requests and sends to OpenAI API
4. Analysis results are returned to frontend
5. Results are stored in localStorage for persistence
6. Loading states are updated to show completion
7. Green and purple result buttons appear for viewing results
8. User clicks either button to open the analysis drawer

## State Management

The application uses several state management approaches:

### React Query
- Used for API request state management
- Handles caching, loading states, and error handling
- Key endpoints cached: server list, channel list, messages

### Local Component State
- `useState` for component-specific UI state
- Examples: drawer open/closed, loading states, current selection

### Local Storage
- Persists analysis results between sessions
- Stores per-channel analysis data
- Tracks UI state across page reloads

Key localStorage items:
- `channelAnalysisMap`: Map of channel IDs to sentiment analysis results
- `jtbdAnalysisMap`: Map of channel IDs to JTBD analysis results
- `lastAnalysisReset`: Timestamp for tracking page reloads
- `currentAnalysisType`: Tracks which analysis is being viewed

## User Experience Flows

### Server and Channel Navigation

1. User logs in and sees server list in sidebar
2. Clicking a server shows its channels
3. Selecting a channel shows messages in main view
4. Channel name and info displayed in fixed header
5. Messages display in scrollable container

### Message Analysis

1. User views messages in a channel
2. Clicks "Analyze this chatter" button
3. Green and purple spinners indicate analysis in progress
4. Upon completion, result buttons appear
5. Clicking result button shows slide-out drawer with analysis
6. User can download analysis or close drawer
7. JTBD button has info icon for framework explanation

### Page Reload Behavior

1. User reloads the page
2. Application detects reload via session tracking
3. Analysis states reset to default (`idle`)
4. All analysis buttons are hidden
5. User must initiate new analysis

## API Reference

### Discord Integration

- `GET /api/servers`: Retrieve available Discord servers
- `GET /api/servers/:serverId/channels`: Get channels for a specific server
- `GET /api/channels/:channelId/messages`: Get recent messages (default 50)
- `GET /api/channels/:channelId/messages?all=true`: Get all messages

### Analysis Endpoints

- `POST /api/channels/:channelId/analyze-sentiment`: Analyze sentiment in messages
  - Request body: `{ messages: DiscordMessage[] }`
  - Response: `{ analysis: string, messagesAnalyzed: number, generatedAt: string }`

- `POST /api/channels/:channelId/analyze-jtbd`: Analyze Jobs to be Done (JTBD) in messages
  - Request body: `{ messages: DiscordMessage[] }`
  - Response: `{ analysis: string, messagesAnalyzed: number, generatedAt: string }`

### Authentication

- `POST /api/discord/token`: Update Discord bot token
  - Request body: `{ token: string }`
  - Response: `{ valid: boolean, message: string }`

## Analysis Features

### Sentiment Analysis

Sentiment analysis examines the emotional tone, social dynamics, and key themes in the Discord messages. The implementation:

1. Collects all messages from the selected channel
2. Formats them for the OpenAI API
3. Uses a specialized system prompt to guide the analysis
4. Returns a Markdown-formatted report of findings

Prompt configuration:
- System prompt focuses on Discord chat sentiment and dynamics
- Temperature: 0.7 (moderate creativity)
- Max tokens: 500 (concise response)

### Jobs to be Done (JTBD) Analysis

JTBD analysis identifies the underlying jobs, tasks, and needs users are trying to accomplish based on their messages. The implementation:

1. Collects all messages from the selected channel
2. Formats them for the OpenAI API
3. Uses a specialized system prompt focused on the JTBD framework
4. Returns a Markdown-formatted report with specific sections

Prompt configuration:
- System prompt specifically addresses JTBD framework
- Response structure includes:
  - Primary User Needs
  - Functional Jobs
  - Emotional Jobs
  - Social Jobs
- Temperature: 0.7 (moderate creativity)
- Max tokens: 500 (concise response)

### Analysis Results UI

Results are displayed in a slide-out drawer that:
1. Takes up half the screen width
2. Has a backdrop blur for focus
3. Shows timestamp of when analysis was generated
4. Provides download button for saving results
5. Preserves content context while viewing results

## Performance Considerations

### API Request Optimization
- React Query implements stale-while-revalidate caching
- API responses are cached for 60 seconds by default
- Messages are cached in memory to reduce API calls

### UI Performance
- Message list uses efficient rendering patterns
- Analysis drawer uses CSS transitions for smooth animations
- Local storage prevents unnecessary API calls for repeated analyses

---

## Troubleshooting Common Issues

### Discord API Connection
- Ensure valid Discord bot token is provided
- Check server logs for connection errors
- Verify bot has proper permissions in Discord server settings

### Analysis Not Working
- Confirm OpenAI API key is valid and has sufficient credits
- Check network tab for API call failures
- Verify channel has enough messages for meaningful analysis

### UI State Issues
- Clear browser localStorage if analysis buttons don't reset properly
- Check browser console for React errors
- Ensure all dependencies are installed correctly

---

*Last updated: March 28, 2025*
