import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from groq import Groq
from tavily import TavilyClient
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import uuid

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
MONGODB_URL = os.getenv("MONGODB_URL")

if not GROQ_API_KEY or not TAVILY_API_KEY:
    raise ValueError("Missing API keys in .env file")

groq_client = Groq(api_key=GROQ_API_KEY)
tavily_client = TavilyClient(api_key=TAVILY_API_KEY)

# MongoDB setup
# Change these lines:
mongo_client = AsyncIOMotorClient(MONGODB_URL) if MONGODB_URL else None
db = mongo_client["live_ai_assistant"] if mongo_client is not None else None
chats_collection = db["chats"] if db is not None else None
app = FastAPI(title="Live AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[Message] = []
    language_instruction: Optional[str] = ""
    detected_language: Optional[str] = "en"
    session_id: Optional[str] = None   # ← new

class ChatResponse(BaseModel):
    reply: str
    history: List[Message]
    is_searching: bool = False
    session_id: str                    # ← new

SYSTEM_PROMPT = """You are a helpful AI assistant. Rules you MUST follow:

1. Keep answers SHORT and to the point — 2 to 4 sentences max for simple questions
2. Only give long answers if the user explicitly asks for detail, explanation, or a list
3. Never repeat the question back to the user
4. Never add unnecessary disclaimers, intros, or filler phrases like "Great question!" or "Certainly!"
5. If you use web search results, summarize only what's relevant — don't dump everything
6. Always cite sources briefly at the end when using web search, like: (Source: title)
7. Match your answer length to the complexity of the question"""


async def save_to_mongo(session_id: str, user_msg: str, assistant_msg: str, lang: str):
    """Save each exchange to MongoDB."""
    if not chats_collection:
        return
    try:
        await chats_collection.update_one(
            {"session_id": session_id},
            {
                "$push": {
                    "messages": {
                        "$each": [
                            {"role": "user", "content": user_msg, "timestamp": datetime.utcnow()},
                            {"role": "assistant", "content": assistant_msg, "timestamp": datetime.utcnow()},
                        ]
                    }
                },
                "$set": {
                    "updated_at": datetime.utcnow(),
                    "language": lang,
                },
                "$setOnInsert": {
                    "created_at": datetime.utcnow(),
                }
            },
            upsert=True
        )
    except Exception as e:
        print(f"MongoDB save error: {e}")


@app.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    user_message = request.message.strip()
    history = request.history or []
    lang_instruction = request.language_instruction or ""
    session_id = request.session_id or str(uuid.uuid4())  # create new session if none

    history.append(Message(role="user", content=user_message))

    conversation_text = "\n".join([
        f"{msg.role.upper()}: {msg.content}" for msg in history[:-1]
    ])

    system_prompt = SYSTEM_PROMPT
    if lang_instruction:
        system_prompt += f"\n\nLANGUAGE RULE (HIGHEST PRIORITY): {lang_instruction} Never ignore this rule."

    decision_prompt = f"""{system_prompt}

Conversation history:
{conversation_text}

User's latest question: {user_message}

Do you need to search the web for current information?
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

    final_prompt = f"""{system_prompt}

Conversation history:
{conversation_text}

User's latest question: {user_message}"""

    if search_results:
        final_prompt += f"\n\nWeb search results:\n{search_results}\n\nProvide a comprehensive answer based on these results."

    if lang_instruction:
        final_prompt += f"\n\nREMINDER: {lang_instruction}"

    final_response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": final_prompt}],
        temperature=0.7,
        max_tokens=1024,
    )
    assistant_reply = final_response.choices[0].message.content

    history.append(Message(role="assistant", content=assistant_reply))

    # Save to MongoDB in background
    await save_to_mongo(
        session_id=session_id,
        user_msg=user_message,
        assistant_msg=assistant_reply,
        lang=request.detected_language or "en"
    )

    return ChatResponse(
        reply=assistant_reply,
        history=history,
        is_searching=is_searching,
        session_id=session_id
    )


@app.get("/history/{session_id}")
async def get_history(session_id: str):
    """Get full chat history for a session."""
    if not chats_collection:
        return {"messages": []}
    try:
        doc = await chats_collection.find_one({"session_id": session_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return doc
        return {"messages": []}
    except Exception as e:
        return {"error": str(e)}


@app.get("/sessions")
async def get_sessions():
    """Get all chat sessions (for sidebar later)."""
    if not chats_collection:
        return {"sessions": []}
    try:
        cursor = chats_collection.find(
            {},
            {"session_id": 1, "created_at": 1, "updated_at": 1, "language": 1, "messages": {"$slice": 1}}
        ).sort("updated_at", -1).limit(20)
        sessions = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            sessions.append(doc)
        return {"sessions": sessions}
    except Exception as e:
        return {"error": str(e)}


@app.get("/health")
async def health_check():
    return {"status": "ok", "mongodb": "connected" if mongo_client else "not configured"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)