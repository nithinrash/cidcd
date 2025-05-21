# streamlit run sales_service_AI/6_3.py
import streamlit as st
import requests
from PIL import Image

# --- Page Setup ---
st.set_page_config(page_title="Winger IT - AI Support", layout="centered")

# --- Logo and Title ---
logo = Image.open("logo.png")
st.image(logo, width=180)

st.markdown("""
    <div style="text-align: center; margin-top: -20px;">
        <h1 style="font-size: 2.8rem; background: -webkit-linear-gradient(45deg, #1a73e8, #72c0ff);
                   -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: bold;">
            Winger IT Solutions
        </h1>
        <h3 style="color: #444; font-weight: 300;">Empowers IT Infrastructure | AI Support Desk</h3>
    </div>
""", unsafe_allow_html=True)

# --- Feature Badges ---
st.markdown("""
<div style="margin-top: 10px; text-align: center;">
    <span style="background-color: #e8f0fe; color: #1a73e8; padding: 8px 14px; border-radius: 30px; margin: 4px; display: inline-block;">
        📧 Email Notification Integrated
    </span>
    <span style="background-color: #e6f4ea; color: #188038; padding: 8px 14px; border-radius: 30px; margin: 4px; display: inline-block;">
        🧠 Smart Session-based Memory
    </span>
    <span style="background-color: #fff3cd; color: #856404; padding: 8px 14px; border-radius: 30px; margin: 4px; display: inline-block;">
        📄 Document-Aware Answers
    </span>
    <span style="background-color: #fce8e6; color: #d93025; padding: 8px 14px; border-radius: 30px; margin: 4px; display: inline-block;">
        👩‍💼 Human Escalation Support
    </span>
</div>
""", unsafe_allow_html=True)

# --- Instructional Message ---
st.markdown("""
<div style="text-align: center; margin-top: 1.2rem;">
    🤖 *Need human help? Just type* <strong>"Contact Human"</strong> *at any time and a Winger IT specialist will reach out within 24-48 hours 😊*
</div>
""", unsafe_allow_html=True)

# --- Styling ---
st.markdown("""
    <style>
        html, body, .block-container {
            background: linear-gradient(145deg, #e3f2fd, #ffffff);
            font-family: 'Segoe UI', sans-serif;
        }
        .block-container {
            border-radius: 18px;
            padding: 2rem 2.5rem;
            background: rgba(255, 255, 255, 0.5);
            backdrop-filter: blur(14px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        input, textarea {
            border: 1px solid #ccc !important;
            border-radius: 10px !important;
        }
        .stTextInput > div > div > input {
            padding: 10px 12px;
            font-size: 1rem;
        }
        .stButton > button {
            background: linear-gradient(90deg, #1a73e8, #67b3f3);
            color: white;
            border-radius: 10px;
            padding: 10px 20px;
            font-weight: bold;
            border: none;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: 0.3s ease;
        }
        .stButton > button:hover {
            background: linear-gradient(90deg, #155ab6, #509ee6);
            transform: scale(1.03);
        }
        .stChatMessage {
            background: rgba(255, 255, 255, 0.4);
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 12px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.07);
        }
        .stChatMessage p {
            margin: 0;
        }
        .stExpander > summary {
            font-weight: 500;
            color: #1a73e8;
        }
    </style>
""", unsafe_allow_html=True)

# --- Ticket Input Section ---
st.markdown("### 🎫 Ticket Details")
default_ticket = st.session_state.get("ticket_id", "")
ticket_id_input = st.text_input("Enter your ticket number (or leave blank to create a new one):", default_ticket)

if st.button("💬 Start Chat"):
    with st.spinner("🔄 Connecting to AI support..."):
        try:
            res = requests.post("http://localhost:8000/start_chat", json={"ticket_id": ticket_id_input})
            res.raise_for_status()
            data = res.json()
            st.session_state["ticket_id"] = data["ticket_id"]
            st.session_state["chat_history"] = data["chat"]
            st.success(f"✅ Chat session started for `{data['ticket_id']}`")
            st.success("🗨️ You're now connected with Winger AI Support. Ask anything about your query, product, or service!")
        except Exception as e:
            st.error(f"❌ Failed to initiate chat session: {str(e)}")

# --- Chat Section ---
if "chat_history" in st.session_state:
    st.markdown("### 💬 Chat Support")

    for msg in st.session_state["chat_history"]:
        if msg["role"] == "user":
            st.chat_message("user").write(f"🧑‍💼 {msg['user']}")
        elif msg["role"] == "ai":
            st.chat_message("assistant").write(f"🤖 {msg['ai']}")

    user_input = st.chat_input("Type your message here...")

    if user_input:
        st.chat_message("user").write(f"🧑‍💼 {user_input}")
        try:
            res = requests.post("http://localhost:8000/chat", json={
                "ticket_id": st.session_state["ticket_id"],
                "message": user_input
            })
            res.raise_for_status()
            res_data = res.json()
            ai_response = res_data["response"]

            st.session_state["chat_history"].append({"role": "user", "user": user_input})
            st.session_state["chat_history"].append({"role": "ai", "ai": ai_response})
            st.chat_message("assistant").write(f"🤖 {ai_response}")

            # Escalation trigger
            if "contact you within 24 to 48 hours" in ai_response.lower():
                st.info("⚠️ This ticket has been escalated to a human support specialist.")

            # Retrieved documents display
            if "retrieved_docs" in res_data:
                with st.expander("📄 View Retrieved Documents"):
                    for i, doc in enumerate(res_data["retrieved_docs"]):
                        source = doc.get("metadata", {}).get("source", "Unknown Source")
                        content = doc.get("page_content", "[No content]")
                        st.markdown(f"**Document {i+1}** — *{source}*")
                        st.code(content[:1000])

        except Exception as e:
            st.error(f"❌ Failed to get AI response: {str(e)}")
