import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from groq import Groq
from tavily import TavilyClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize API clients
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

if not GROQ_API_KEY or not TAVILY_API_KEY:
    raise ValueError("Missing API keys in .env file")

groq_client = Groq(api_key=GROQ_API_KEY)
tavily_client = TavilyClient(api_key=TAVILY_API_KEY)

# Initialize FastAPI app
app = FastAPI(title="Live AI Assistant")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for deployed frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[Message] = []

class ChatResponse(BaseModel):
    reply: str
    history: List[Message]
    is_searching: bool = False

# System prompt for Groq
SYSTEM_PROMPT = """You are a helpful AI assistant. Rules you MUST follow:

1. Keep answers SHORT and to the point — 2 to 4 sentences max for simple questions
2. Only give long answers if the user explicitly asks for detail, explanation, or a list
3. Never repeat the question back to the user
4. Never add unnecessary disclaimers, intros, or filler phrases like "Great question!" or "Certainly!"
5. If you use web search results, summarize only what's relevant — don't dump everything
6. Always cite sources briefly at the end when using web search, like: (Source: title)
7. Match your answer length to the complexity of the question"""

@app.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Chat endpoint that receives a message and conversation history.
    Uses Groq to decide if web search is needed, then returns a response.
    """
    user_message = request.message.strip()
    history = request.history or []
    
    # Add current message to history
    history.append(Message(role="user", content=user_message))
    
    # Build conversation for context
    conversation_text = "\n".join([
        f"{msg.role.upper()}: {msg.content}" for msg in history[:-1]
    ])
    
    # First, ask Groq if it needs to search the web
    decision_prompt = f"""{SYSTEM_PROMPT}

Conversation history:
{conversation_text}

User's latest question: {user_message}

Based on the user's question, do you need to search the web for current information? 
Answer with ONLY "YES" or "NO" (nothing else)."""
    
    decision_response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": decision_prompt}],
        temperature=0.3,
        max_tokens=10,
    )
    search_decision = decision_response.choices[0].message.content.strip().upper()
    
    search_results = ""
    is_searching = False
    
    # If web search is needed, use Tavily
    if "YES" in search_decision:
        is_searching = True
        try:
            response = tavily_client.search(query=user_message, max_results=5)
            if response and "results" in response:
                search_results = "\n\n".join([
                    f"Source: {result.get('title', 'Unknown')}\n{result.get('content', '')}"
                    for result in response["results"]
                ])
        except Exception as e:
            search_results = f"Error during web search: {str(e)}"
    
    # Generate final response using Groq
    final_prompt = f"""{SYSTEM_PROMPT}

Conversation history:
{conversation_text}

User's latest question: {user_message}"""
    
    if search_results:
        final_prompt += f"\n\nWeb search results:\n{search_results}\n\nPlease provide a comprehensive answer based on these search results."
    
    final_response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": final_prompt}],
        temperature=0.7,
        max_tokens=1024,
    )
    assistant_reply = final_response.choices[0].message.content
    
    # Add assistant response to history
    history.append(Message(role="assistant", content=assistant_reply))
    
    return ChatResponse(
        reply=assistant_reply,
        history=history,
        is_searching=is_searching
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
