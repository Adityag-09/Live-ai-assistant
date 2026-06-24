import os
import bcrypt
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
import io
import base64
from PIL import Image
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
from fastapi.responses import StreamingResponse as FastAPIStreamingResponse
import json
from collections import defaultdict
import time

# ── Rate limiting ─────────────────────────────────────────
rate_limit_store = defaultdict(lambda: {
    'hourly': [],
    'half_daily': [],
})
guest_message_counts = defaultdict(int)
HOURLY_LIMIT = 30
HALF_DAILY_LIMIT = 70
GUEST_LIMIT = 10

def check_rate_limit(user_id: str):
    now = time.time()
    store = rate_limit_store[user_id]
    store['hourly'] = [t for t in store['hourly'] if now - t < 3600]
    store['half_daily'] = [t for t in store['half_daily'] if now - t < 43200]

    if len(store['hourly']) >= HOURLY_LIMIT:
        reset_time = store['hourly'][0] + 3600
        reset_str = datetime.fromtimestamp(reset_time).strftime('%I:%M %p')
        raise HTTPException(status_code=429,
            detail=f"⏳ Hourly limit reached (30/30 messages). Resets at {reset_str}.")

    if len(store['half_daily']) >= HALF_DAILY_LIMIT:
        reset_time = store['half_daily'][0] + 43200
        reset_str = datetime.fromtimestamp(reset_time).strftime('%I:%M %p')
        raise HTTPException(status_code=429,
            detail=f"🚫 Daily limit reached (70/70 messages). Your credits reset at {reset_str}.")

    store['hourly'].append(now)
    store['half_daily'].append(now)
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

# ── System prompt ─────────────────────────────────────────
SYSTEM_PROMPT = """You are a helpful AI assistant. Rules you MUST follow:

1. Keep answers SHORT and to the point — 2 to 4 sentences max for simple questions
2. Only give long answers if the user explicitly asks for detail, explanation, or a list
3. Never repeat the question back to the user
4. Never add unnecessary disclaimers, intros, or filler phrases like "Great question!" or "Certainly!"
5. If you use web search results, summarize only what's relevant
6. DO NOT cite sources or add (Source: ...) at the end of responses. Never mention where you got the information from.
7. Match your answer length to the complexity of the question"""

# ── Search keywords (replaces AI decision call) ───────────
SEARCH_KEYWORDS = [
    'latest', 'today', 'current', 'now', 'news', 'price',
    'weather', 'score', 'who is', 'what is', '2025', '2026',
    'recent', 'trending', 'live', 'update', 'yesterday',
    'this week', 'this month', 'happened', 'result', 'winner',
    'released', 'launch', 'announced', 'breaking', 'stock',
    'crypto', 'bitcoin', 'election', 'match', 'game', 'ipl',
    'war', 'earthquake', 'flood', 'disaster', 'new model',
    'just', 'recently', 'right now', 'at the moment'
]

def should_search(message: str) -> bool:
    msg_lower = message.lower()
    return any(kw in msg_lower for kw in SEARCH_KEYWORDS)

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
    file_context: Optional[str] = None
    file_type: Optional[str] = None
    file_name: Optional[str] = None
    mime_type: Optional[str] = None

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

    if "@" not in request.email or "." not in request.email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

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

# ── Auto title generator ──────────────────────────────────
async def generate_title(user_msg: str) -> str:
    try:
        res = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": f"Generate a very short 4-6 word title for a chat that starts with: '{user_msg}'. Reply with ONLY the title, no quotes, no punctuation."}],
            temperature=0.5,
            max_tokens=20,
        )
        return res.choices[0].message.content.strip()[:60]
    except:
        return user_msg[:50]

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

# ── Search helper ─────────────────────────────────────────
async def run_search(query: str) -> str:
    try:
        response = tavily_client.search(query=query, max_results=5)
        if response and "results" in response:
            return "\n\n".join([
                f"Source: {r.get('title', 'Unknown')}\n{r.get('content', '')}"
                for r in response["results"]
            ])
    except Exception as e:
        return f"Search error: {str(e)}"
    return ""

# ── Guest chat route ──────────────────────────────────────
@app.post("/chat/guest")
async def chat_guest(request: ChatRequest) -> ChatResponse:
    user_message = request.message.strip()
    history = request.history or []
    lang_instruction = request.language_instruction or ""
    session_id = request.session_id or str(uuid.uuid4())
    guest_message_counts[session_id] += 1
    if guest_message_counts[session_id] > GUEST_LIMIT:
        raise HTTPException(status_code=429,
            detail="🔒 Guest limit reached (10 messages)! Sign up free → get 30/hour and 70 per 12 hours.")

    history.append(Message(role="user", content=user_message))
    conversation_text = "\n".join([f"{msg.role.upper()}: {msg.content}" for msg in history[:-1]])

    system_prompt = SYSTEM_PROMPT
    if lang_instruction:
        system_prompt += f"\n\nLANGUAGE RULE (HIGHEST PRIORITY): {lang_instruction} Never ignore this rule."

    # Keyword-based search decision — no extra API call!
    is_searching = should_search(user_message)
    search_results = await run_search(user_message) if is_searching else ""

    final_prompt = f"{system_prompt}\n\nConversation history:\n{conversation_text}\n\nUser's latest question: {user_message}"
    if search_results:
        final_prompt += f"\n\nWeb search results:\n{search_results}\n\nProvide a comprehensive answer."
    if lang_instruction:
        final_prompt += f"\n\nREMINDER: {lang_instruction}"

    final_response = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": final_prompt}],
        temperature=0.7, max_tokens=1024,
    )
    assistant_reply = final_response.choices[0].message.content
    history.append(Message(role="assistant", content=assistant_reply))

    return ChatResponse(reply=assistant_reply, history=history, is_searching=is_searching, session_id=session_id)

# ── Auth chat route ───────────────────────────────────────
@app.post("/chat")
async def chat(request: ChatRequest, current_user=Depends(get_current_user)) -> ChatResponse:
    user_message = request.message.strip()
    history = request.history or []
    lang_instruction = request.language_instruction or ""
    session_id = request.session_id or str(uuid.uuid4())
    user_id = current_user["_id"]
    is_new_session = not request.session_id
    check_rate_limit(user_id) 
    history.append(Message(role="user", content=user_message))
    conversation_text = "\n".join([f"{msg.role.upper()}: {msg.content}" for msg in history[:-1]])

    system_prompt = SYSTEM_PROMPT
    if lang_instruction:
        system_prompt += f"\n\nLANGUAGE RULE (HIGHEST PRIORITY): {lang_instruction} Never ignore this rule."

    # Keyword-based search decision — no extra API call!
    is_searching = should_search(user_message)
    search_results = await run_search(user_message) if is_searching else ""

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

    title = await generate_title(user_message) if is_new_session else None

    await save_to_mongo(
        session_id=session_id,
        user_id=user_id,
        user_msg=user_message,
        assistant_msg=assistant_reply,
        lang=request.detected_language or "en",
        title=title
    )

    return ChatResponse(reply=assistant_reply, history=history, is_searching=is_searching, session_id=session_id)

# ── Streaming chat route ──────────────────────────────────
@app.post("/chat/stream")
async def chat_stream(request: ChatRequest, current_user=Depends(get_current_user)):
    user_message = request.message.strip()
    history = request.history or []
    lang_instruction = request.language_instruction or ""
    session_id = request.session_id or str(uuid.uuid4())
    user_id = current_user["_id"]
    is_new_session = not request.session_id
    check_rate_limit(user_id) 

    history.append(Message(role="user", content=user_message))
    conversation_text = "\n".join([f"{msg.role.upper()}: {msg.content}" for msg in history[:-1]])

    system_prompt = SYSTEM_PROMPT
    if lang_instruction:
        system_prompt += f"\n\nLANGUAGE RULE (HIGHEST PRIORITY): {lang_instruction} Never ignore this rule."

    # Keyword-based search decision — no extra API call!
    is_searching = should_search(user_message)
    search_results = await run_search(user_message) if is_searching else ""

    # Build user content (handle attached file)
    if request.file_type == "image":
        user_content = [
            {"type": "image_url", "image_url": {"url": f"data:{request.mime_type};base64,{request.file_context}"}},
            {"type": "text", "text": user_message or "What is in this image?"}
        ]
    elif request.file_type == "text" and request.file_context:
        user_content = f"[Attached file: {request.file_name}]\n\n{request.file_context}\n\n---\nUser's question: {user_message}"
    else:
        user_content = user_message

    final_prompt = f"""{system_prompt}

Conversation history:
{conversation_text}

User's latest question: {user_message if isinstance(user_content, list) else user_content}"""

    if search_results:
        final_prompt += f"\n\nWeb search results:\n{search_results}\n\nProvide a comprehensive answer."
    if lang_instruction:
        final_prompt += f"\n\nREMINDER: {lang_instruction}"

    async def generate():
        full_reply = ""
        try:
            yield f"data: {json.dumps({'type': 'status', 'is_searching': is_searching, 'session_id': session_id})}\n\n"

            if request.file_type == "image":
                groq_messages = [{"role": "user", "content": user_content}]
                vision_model = "llama-3.2-90b-vision-preview"
            else:
                groq_messages = [{"role": "user", "content": final_prompt}]
                vision_model = "llama-3.1-8b-instant"

            stream = groq_client.chat.completions.create(
                model=vision_model,
                messages=groq_messages,
                temperature=0.7,
                max_tokens=1024,
                stream=True,
            )

            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    full_reply += delta
                    yield f"data: {json.dumps({'type': 'chunk', 'content': delta})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"

            title = await generate_title(user_message) if is_new_session else None
            await save_to_mongo(
                session_id=session_id,
                user_id=user_id,
                user_msg=user_message,
                assistant_msg=full_reply,
                lang=request.detected_language or "en",
                title=title
            )

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return FastAPIStreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

# ── Guest streaming route ─────────────────────────────────
@app.post("/chat/guest/stream")
async def chat_guest_stream(request: ChatRequest):
    user_message = request.message.strip()
    history = request.history or []
    lang_instruction = request.language_instruction or ""
    session_id = request.session_id or str(uuid.uuid4())
    guest_message_counts[session_id] += 1
    if guest_message_counts[session_id] > GUEST_LIMIT:
     raise HTTPException(status_code=429,
        detail="🔒 Guest limit reached (10 messages)! Sign up free → get 30/hour and 70 per 12 hours.")


    history.append(Message(role="user", content=user_message))
    conversation_text = "\n".join([f"{msg.role.upper()}: {msg.content}" for msg in history[:-1]])

    system_prompt = SYSTEM_PROMPT
    if lang_instruction:
        system_prompt += f"\n\nLANGUAGE RULE (HIGHEST PRIORITY): {lang_instruction} Never ignore this rule."

    # Keyword-based search decision — no extra API call!
    is_searching = should_search(user_message)
    search_results = await run_search(user_message) if is_searching else ""

    if request.file_type == "text" and request.file_context:
        file_prefix = f"[Attached file: {request.file_name}]\n\n{request.file_context}\n\n---\nUser's question: "
    else:
        file_prefix = ""

    final_prompt = f"{system_prompt}\n\nConversation history:\n{conversation_text}\n\nUser's latest question: {file_prefix}{user_message}"
    if search_results:
        final_prompt += f"\n\nWeb search results:\n{search_results}\n\nProvide a comprehensive answer."
    if lang_instruction:
        final_prompt += f"\n\nREMINDER: {lang_instruction}"

    async def generate():
        try:
            yield f"data: {json.dumps({'type': 'status', 'is_searching': is_searching, 'session_id': session_id})}\n\n"

            stream = groq_client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": final_prompt}],
                temperature=0.7, max_tokens=1024, stream=True,
            )

            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield f"data: {json.dumps({'type': 'chunk', 'content': delta})}\n\n"

            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return FastAPIStreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

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
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    MAX_SIZE = 10 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    filename = file.filename.lower()
    extracted = ""

    try:
        if filename.endswith(".pdf"):
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            for page in reader.pages:
                extracted += page.extract_text() or ""
            if not extracted.strip():
                raise HTTPException(status_code=422, detail="Could not extract text from this PDF. It may be image-based.")

        elif filename.endswith((".txt", ".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".csv", ".md", ".html", ".css")):
            extracted = content.decode("utf-8", errors="ignore")

        elif filename.endswith(".docx"):
            from docx import Document
            doc = Document(io.BytesIO(content))
            extracted = "\n".join([para.text for para in doc.paragraphs])

        elif filename.endswith(".xlsx"):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            for sheet in wb.worksheets:
                extracted += f"\n[Sheet: {sheet.title}]\n"
                for row in sheet.iter_rows(values_only=True):
                    row_text = "\t".join([str(c) if c is not None else "" for c in row])
                    extracted += row_text + "\n"

        elif filename.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
            b64 = base64.b64encode(content).decode("utf-8")
            mime = (
                "image/jpeg" if filename.endswith((".jpg", ".jpeg")) else
                "image/png" if filename.endswith(".png") else
                "image/webp" if filename.endswith(".webp") else "image/gif"
            )
            return {
                "type": "image",
                "filename": file.filename,
                "mime_type": mime,
                "b64": b64,
                "size": len(content),
            }

        else:
            raise HTTPException(status_code=415, detail=f"Unsupported file type: .{filename.split('.')[-1]}")

        if len(extracted) > 12000:
            extracted = extracted[:12000] + "\n\n[... file truncated to fit context ...]"

        return {
            "type": "text",
            "filename": file.filename,
            "content": extracted.strip(),
            "size": len(content),
            "chars": len(extracted),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
    
@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    return {"status": "ok", "mongodb": "connected" if mongo_client is not None else "not configured"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)