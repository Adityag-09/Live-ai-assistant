import os
import bcrypt
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from groq import Groq
from tavily import TavilyClient
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from jose import JWTError, jwt
import uuid

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
MONGODB_URL = os.getenv("MONGODB_URL")
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

groq_client = Groq(api_key=GROQ_API_KEY)
tavily_client = TavilyClient(api_key=TAVILY_API_KEY)

mongo_client = AsyncIOMotorClient(MONGODB_URL) if MONGODB_URL else None
db = mongo_client["live_ai_assistant"] if mongo_client is not None else None
chats_collection = db["chats"] if db is not None else None
users_collection = db["users"] if db is not None else None

security = HTTPBearer(auto_error=False)

app = FastAPI(title="Live AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://live-ai-frontend.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ────────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[Message] = []
    language_instruction: Optional[str] = ""
    detected_language: Optional[str] = "en"
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    history: List[Message]
    is_searching: bool = False
    session_id: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user: dict

# ── Auth helpers ──────────────────────────────────────────
def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if users_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    user = await users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ── Auth routes ───────────────────────────────────────────
@app.post("/auth/signup")
async def signup(request: SignupRequest):
    if users_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    existing = await users_collection.find_one({"email": request.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    user = {
        "_id": user_id,
        "name": request.name,
        "email": request.email.lower(),
        "password": hash_password(request.password),
        "created_at": datetime.utcnow(),
    }
    await users_collection.insert_one(user)
    token = create_token(user_id)

    return AuthResponse(
        token=token,
        user={"id": user_id, "name": request.name, "email": request.email.lower()}
    )

@app.post("/auth/login")
async def login(request: LoginRequest):
    if users_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    user = await users_collection.find_one({"email": request.email.lower()})
    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(user["_id"])

    return AuthResponse(
        token=token,
        user={"id": user["_id"], "name": user["name"], "email": user["email"]}
    )

@app.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return {"id": current_user["_id"], "name": current_user["name"], "email": current_user["email"]}

# ── System prompt ─────────────────────────────────────────
SYSTEM_PROMPT = """You are a helpful AI assistant. Rules you MUST follow:

1. Keep answers SHORT and to the point — 2 to 4 sentences max for simple questions
2. Only give long answers if the user explicitly asks for detail, explanation, or a list
3. Never repeat the question back to the user
4. Never add unnecessary disclaimers, intros, or filler phrases like "Great question!" or "Certainly!"
5. If you use web search results, summarize only what's relevant
6. Always cite sources briefly at the end when using web search, like: (Source: title)
7. Match your answer length to the complexity of the question"""

# ── MongoDB helpers ───────────────────────────────────────
async def save_to_mongo(session_id: str, user_id: str, user_msg: str, assistant_msg: str, lang: str, title: str = None):
    if chats_collection is None:
        return
    try:
        update = {
            "$push": {
                "messages": {
                    "$each": [
                        {"role": "user", "content": user_msg, "timestamp": datetime.utcnow()},
                        {"role": "assistant", "content": assistant_msg, "timestamp": datetime.utcnow()},
                    ]
                }
            },
            "$set": {"updated_at": datetime.utcnow(), "language": lang},
            "$setOnInsert": {
                "created_at": datetime.utcnow(),
                "user_id": user_id,
                "title": title or user_msg[:50],
            }
        }
        await chats_collection.update_one({"session_id": session_id}, update, upsert=True)
    except Exception as e:
        print(f"MongoDB save error: {e}")

# ── Chat route ────────────────────────────────────────────
@app.post("/chat")
async def chat(request: ChatRequest, current_user=Depends(get_current_user)) -> ChatResponse:
    user_message = request.message.strip()
    history = request.history or []
    lang_instruction = request.language_instruction or ""
    session_id = request.session_id or str(uuid.uuid4())
    user_id = current_user["_id"]

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

    await save_to_mongo(
        session_id=session_id,
        user_id=user_id,
        user_msg=user_message,
        assistant_msg=assistant_reply,
        lang=request.detected_language or "en",
        title=user_message[:50]
    )

    return ChatResponse(reply=assistant_reply, history=history, is_searching=is_searching, session_id=session_id)

# ── Session routes ────────────────────────────────────────
@app.get("/sessions")
async def get_sessions(current_user=Depends(get_current_user)):
    if chats_collection is None:
        return {"sessions": []}
    try:
        cursor = chats_collection.find(
            {"user_id": current_user["_id"]},
            {"session_id": 1, "title": 1, "created_at": 1, "updated_at": 1, "language": 1}
        ).sort("updated_at", -1).limit(30)
        sessions = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            sessions.append(doc)
        return {"sessions": sessions}
    except Exception as e:
        return {"error": str(e)}

@app.get("/history/{session_id}")
async def get_history(session_id: str, current_user=Depends(get_current_user)):
    if chats_collection is None:
        return {"messages": []}
    try:
        doc = await chats_collection.find_one({
            "session_id": session_id,
            "user_id": current_user["_id"]
        })
        if doc:
            doc["_id"] = str(doc["_id"])
            return doc
        return {"messages": []}
    except Exception as e:
        return {"error": str(e)}

@app.delete("/history/{session_id}")
async def delete_session(session_id: str, current_user=Depends(get_current_user)):
    if chats_collection is None:
        return {"success": False}
    try:
        await chats_collection.delete_one({
            "session_id": session_id,
            "user_id": current_user["_id"]
        })
        return {"success": True}
    except Exception as e:
        return {"error": str(e)}

@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    return {"status": "ok", "mongodb": "connected" if mongo_client is not None else "not configured"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)