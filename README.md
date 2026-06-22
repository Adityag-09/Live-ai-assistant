# Live AI Assistant

A full-stack web application that leverages Gemini 2.0 Flash AI with real-time web search capabilities using Tavily API.

## Features

- **AI-Powered Chat**: Powered by Google's Gemini 2.0 Flash model
- **Intelligent Web Search**: Automatically searches the web when needed for current information
- **Modern Dark UI**: Clean, responsive chat interface with Tailwind CSS
- **Real-time Feedback**: Visual indicators for searching and typing
- **Session Memory**: Full conversation history maintained during the session
- **Production Ready**: Built with FastAPI backend and React frontend

## Project Structure

```
Live-ai-assistant/
├── backend/
│   ├── main.py                 # FastAPI server
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # API keys (create this locally)
│   └── .env.example             # Example .env template
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main React component
│   │   ├── App.css             # Styling
│   │   ├── main.jsx            # Entry point
│   │   └── index.css           # Global styles
│   ├── public/
│   │   └── index.html          # HTML template
│   ├── package.json            # NPM dependencies
│   ├── vite.config.js          # Vite configuration
│   ├── tailwind.config.js      # Tailwind CSS config
│   ├── postcss.config.js       # PostCSS config
│   └── .gitignore
├── README.md                    # This file
└── .gitignore

```

## Prerequisites

- **Python 3.9+** (for backend)
- **Node.js 16+** (for frontend)
- **npm or yarn** (for frontend package management)
- **API Keys**:
  - [Google Gemini API Key](https://aistudio.google.com/app/apikey)
  - [Tavily API Key](https://tavily.com)

## Setup Instructions

### 1. Get API Keys

1. **Gemini API Key**:
   - Visit https://aistudio.google.com/app/apikey
   - Create a new API key

2. **Tavily API Key**:
   - Visit https://tavily.com
   - Sign up and get your API key

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate Python virtual environment
python -m venv venv
venv\Scripts\activate  # On Windows
# or
source venv/bin/activate  # On macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file with your API keys
# Edit .env and add your keys:
# GEMINI_API_KEY=your_gemini_api_key_here
# TAVILY_API_KEY=your_tavily_api_key_here

# Run the backend server
python main.py
```

The backend will start on `http://localhost:8000`

### 3. Frontend Setup

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:3000`

## Running Both Servers

### Option 1: Separate Terminals

**Terminal 1 - Backend:**
```bash
cd backend
venv\Scripts\activate  # Windows
# or source venv/bin/activate  # macOS/Linux
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Option 2: Concurrent (requires concurrently package)

Install concurrently in the root directory:
```bash
npm install -g concurrently
```

Then from the root directory:
```bash
concurrently "cd backend && python main.py" "cd frontend && npm run dev"
```

## API Endpoints

### POST `/chat`
Sends a message and receives an AI response.

**Request:**
```json
{
  "message": "What is the current weather in Paris?",
  "history": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there!"}
  ]
}
```

**Response:**
```json
{
  "reply": "Based on current data, Paris has...",
  "history": [...],
  "is_searching": true
}
```

### GET `/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Features Explained

### Intelligent Web Search
The AI automatically decides whether web search is needed:
- If the question requires current information, Tavily searches the web
- Results are fed back to Gemini for a comprehensive answer
- "Searching the web..." indicator shows during search

### Conversation History
- Full conversation context is maintained in the session
- Each message includes the entire history for better context
- History is stored client-side (not persisted after page refresh)

### Dark Theme UI
- Modern gradient backgrounds
- Cyan/blue accent colors
- Smooth animations and transitions
- Responsive design for mobile devices

## Build for Production

### Backend:
```bash
cd backend
pip install gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend:
```bash
cd frontend
npm run build
# Deploy the dist/ folder to your hosting service
```

## Troubleshooting

### Backend won't start
- Check if port 8000 is already in use
- Verify all dependencies are installed: `pip install -r requirements.txt`
- Ensure .env file exists and has valid API keys

### Frontend won't start
- Check if port 3000 is already in use
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Ensure Node.js version is 16 or higher: `node --version`

### API Connection Error
- Ensure backend is running on localhost:8000
- Check browser console for CORS errors
- Verify CORS is enabled in backend (it should be by default)

### "API keys missing" error
- Check .env file exists in backend directory
- Verify keys are set correctly without extra spaces
- Restart the backend server after updating .env

## Environment Variables

Create a `.env` file in the `backend/` directory:

```
GEMINI_API_KEY=your_actual_gemini_key_here
TAVILY_API_KEY=your_actual_tavily_key_here
```

**Never commit the .env file to version control!**

## Technologies Used

### Backend
- **FastAPI**: Modern Python web framework
- **Uvicorn**: ASGI server
- **google-generativeai**: Google Gemini API client
- **tavily-python**: Tavily web search API client
- **Pydantic**: Data validation

### Frontend
- **React 18**: UI library
- **Vite**: Build tool and dev server
- **Axios**: HTTP client
- **Tailwind CSS**: Utility-first CSS framework

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please check:
1. The troubleshooting section above
2. Backend logs in the terminal
3. Browser console (F12) for frontend errors

---

**Happy chatting with your AI Assistant! 🚀**
