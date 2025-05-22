import os
import json
import asyncio
import signal
from datetime import datetime
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_groq import ChatGroq
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
import smtplib
from email.message import EmailMessage
from fastapi.responses import JSONResponse

os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Paths and setup
TICKET_DIR = 'tickets'
VECTORSTORE_PATH = "vectorstore"
EMBEDDING_MODEL_PATH = "models/all-MiniLM-L6-v2"

os.makedirs(TICKET_DIR, exist_ok=True)

# Initialize LLM
llm = ChatGroq(
    model="llama-3.1-8b-instant",
    temperature=0.7,
    api_key="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"  # Make sure this is correct
)

# Load vector store and embedding model (RAG)
embedding_model = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL_PATH,
    model_kwargs={"local_files_only": True}
)
vectorstore = FAISS.load_local(VECTORSTORE_PATH, embedding_model, allow_dangerous_deserialization=True)
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

# FastAPI app
app = FastAPI(title="Winger IT Support Chat API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request Models
class StartChatRequest(BaseModel):
    ticket_id: str | None = None

class ChatRequest(BaseModel):
    ticket_id: str
    message: str

# Global variable for tracking application state
app_is_ready = False
shutdown_event = asyncio.Event()  # Use an asyncio.Event for shutdown signaling

# Ticket management
def generate_ticket_id():
    date_part = datetime.now().strftime("%Y%m%d")
    base = f"WI{date_part}"
    existing = [
        fname for fname in os.listdir(TICKET_DIR)
        if fname.startswith(f"#{base}") and fname.endswith(".json")
    ]
    next_serial = len(existing) + 1
    return "#" + base + f"{next_serial:04d}"

def ticket_path(ticket_id):
    return os.path.join(TICKET_DIR, f"{ticket_id}.json")

def load_chat_history(ticket_id):
    path = ticket_path(ticket_id)
    if os.path.exists(path):
        with open(path, 'r') as f:
            messages = json.load(f)
    else:
        messages = []

    return [
        SystemMessage(content="You are a helpful customer support assistant, developed by Winger IT Solutions.")
    ] + [
        HumanMessage(content=m["user"]) if m["role"] == "user"
        else AIMessage(content=m["ai"])
        for m in messages
    ]

def save_chat_history(ticket_id, history):
    messages = []
    for msg in history:
        if isinstance(msg, HumanMessage):
            messages.append({"role": "user", "user": msg.content})
        elif isinstance(msg, AIMessage):
            messages.append({"role": "ai", "ai": msg.content})
    with open(ticket_path(ticket_id), 'w') as f:
        json.dump(messages, f, indent=2)

# Email sending function
def send_email_with_attachment(subject, body, to, filename, file_content):
    sender = "shaikfa66@gmail.com"
    password = "mado bkup lbbp hfwj"  # Make sure you're using an App Password!

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.set_content(body)

    msg.add_attachment(
        file_content.encode("utf-8"),
        maintype="application",
        subtype="json",
        filename=filename
    )

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        try:
            smtp.login(sender, password)
            smtp.send_message(msg)
        except Exception as e:
            print(f"Error sending email: {e}") # Log the error.  Important for debugging

# --- FastAPI Routes ---

@app.on_event("startup")
async def startup_event():
    """Startup event handler to perform initialization."""
    global app_is_ready
    # Perform any async initialization here (e.g., connect to databases)
    await asyncio.sleep(1)  # Simulate startup task
    app_is_ready = True  # Set the application state to ready
    print("Application startup complete.")

@app.on_event("shutdown")
async def shutdown_event_handler():
    """Shutdown event handler to perform cleanup."""
    print("Shutting down application...")
    shutdown_event.set()  # Signal that shutdown has started
    # Perform any cleanup tasks here (e.g., close connections)
    await asyncio.sleep(1)
    print("Application shutdown complete.")
    

@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Health check endpoint for Kubernetes probes."""
    if app_is_ready:
        return {"status": "ok"}
    else:
        raise HTTPException(status_code=503, detail="Application not ready")

@app.post("/start_chat")
async def start_chat(req: StartChatRequest):
    ticket_id = req.ticket_id or generate_ticket_id()

    if not os.path.exists(ticket_path(ticket_id)):
        chat_history = [SystemMessage(content="You are a helpful customer support assistant, developed by Winger IT Solutions.")]
        save_chat_history(ticket_id, chat_history)
    else:
        chat_history = load_chat_history(ticket_id)

    history_dicts = []
    for msg in chat_history[1:]:
        if isinstance(msg, HumanMessage):
            history_dicts.append({"role": "user", "user": msg.content})
        elif isinstance(msg, AIMessage):
            history_dicts.append({"role": "ai", "ai": msg.content})

    return {"ticket_id": ticket_id, "chat": history_dicts}

@app.post("/chat")
async def chat(req: ChatRequest):
    ticket_id = req.ticket_id
    if not os.path.exists(ticket_path(ticket_id)):
        raise HTTPException(status_code=404, detail="Ticket ID not found")

    # Step 1: Load history and append user message
    chat_history = load_chat_history(ticket_id)
    chat_history.append(HumanMessage(content=req.message))

    # Check for escalation trigger
    if req.message.strip().lower() == "contact human":
        # Load the full chat history
        chat_history = load_chat_history(ticket_id)

        # Format history as plain conversation text
        convo_text = ""
        for msg in chat_history:
            if isinstance(msg, HumanMessage):
                convo_text += f"User: {msg.content}\n"
            elif isinstance(msg, AIMessage):
                convo_text += f"Assistant: {msg.content}\n"

        # Ask LLM to summarize the conversation
        summary_prompt = f"Summarize this customer support conversation for a human assistant:\n\n{convo_text}"
        try:
            summary = llm.invoke(summary_prompt).content.strip()
        except Exception as e:
            print(f"LLM error during summarization: {e}") #add error logging
            summary = "Failed to generate summary."

        # Compose and send email with summary + attached JSON
        subject = f"Ticket Escalation: {ticket_id}"
        body = f"""
📬 Escalation Notice - Ticket ID: {ticket_id}

A user has requested human assistance. Here is a summary of the conversation so far:

{summary}

The complete chat log is attached.
"""
        # Save latest message
        chat_history.append(AIMessage(content="Thank you. A Human Assistant will contact you within 24 to 48 hours."))
        save_chat_history(ticket_id, chat_history)

        # Send email
        send_email_with_attachment(
            subject=subject,
            body=body,
            to="faisal.shaikh@wingerit.in",
            filename=f"{ticket_id}.json",
            file_content=json.dumps([msg.dict() for msg in chat_history], indent=2)
        )

        return {
            "response": "Thank you. A Human Assistant will contact you within 24 to 48 hours.",
            "retrieved_docs": []
        }

    # Step 2: Get context using RAG (FAISS + embeddings)
    retrieved_docs = retriever.invoke(req.message)
    context = "\n".join([doc.page_content for doc in retrieved_docs])

    # Step 3: Add RAG context as a system message (temporary, not saved)
    chat_with_context = chat_history.copy()
    chat_with_context.insert(1, SystemMessage(content=f"Relevant context:\n{context}"))

    # Step 4: Invoke LLM
    try:
        response = llm.invoke(chat_with_context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM invocation error: {e}")

    # Step 5: Save history without the temporary context message
    chat_history.append(response)
    save_chat_history(ticket_id, chat_history)

    # Step 6: Return response + docs for display
    return {
        "response": response.content,
        "retrieved_docs": [
            {
                "page_content": doc.page_content,
                "metadata": doc.metadata
            } for doc in retrieved_docs
        ]
    }

@app.get("/tickets/")
async def list_tickets():
    """Endpoint to list all ticket files."""
    try:
        files = os.listdir("tickets")
        json_files = [f for f in files if f.endswith(".json")]
        return JSONResponse(content=json_files)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing tickets: {e}")
