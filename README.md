# MakunuType

A modern typing test application for Dhivehi language with phonetic keyboard support.

## Features

- **Multiple Test Modes**
  - Word-based tests: 5, 10, or 20 words
  - Time-based tests: 15, 30, 60, or 120 seconds

- **Phonetic Keyboard Support**
  - Type Dhivehi using English phonetic mappings
  - Intuitive character conversion

- **Performance Metrics**
  - Words per minute (WPM)
  - Raw WPM
  - Accuracy percentage

- **Leaderboard**
  - Global rankings via Supabase
  - Separate leaderboards for each test mode and configuration
  - Fallback to local storage

## Tech Stack

- React 19
- TypeScript
- Vite
- Supabase
- CSS for styling

## Getting Started

### Prerequisites

- Node.js (version 18 or higher recommended)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>

# Navigate to the project directory
cd makunutype

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file in the root directory with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

```bash
# Start the development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

```bash
# Build for production
npm run build

# Preview the production build
npm run preview
```

## How to Use

1. Choose your test mode (Words or Time)
2. Select the configuration (word count or duration)
3. Click on the input area to start typing
4. Type the displayed Dhivehi words using phonetic English characters
5. View your results and save to the leaderboard

## License

MIT


## Security: Signed session-score

To prevent clients from easily manipulating the score submission, the app now signs the POST /api/session-score request with an HMAC signature bound to the current session.

- On app load, the client requests GET /api/session-init with credentials. The server generates a random per-session token and stores it on the session; the same token is returned to the client.
- When posting /api/session-score, the client computes an HMAC-SHA256 over a canonical string:
  "wpm|raw_wpm|accuracy|mode|config|timestamp"
  using the per-session token. The client sends two headers:
  - x-makunu-signature: hex(HMAC-SHA256(token, canonical))
  - x-makunu-timestamp: the timestamp (ms since epoch) used in the canonical string
- The server verifies the signature using the session token and also checks the timestamp is within a time window.

Environment variable:
- SIGNATURE_WINDOW_MS: optional. The maximum allowed drift for x-makunu-timestamp in milliseconds. Default is 300000 (5 minutes).

Notes:
- This mechanism raises the bar against casual tampering by requiring a correct signature per session and rejecting stale replays.
- Ensure your deployment serves the site over HTTPS so session cookies are protected in transit.
