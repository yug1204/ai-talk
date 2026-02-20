import os
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Try importing ElevenLabs, if installed
try:
    from elevenlabs.client import ElevenLabs
    from elevenlabs import save
    ELEVENLABS_AVAILABLE = True
except ImportError:
    ELEVENLABS_AVAILABLE = False

# Load environment variables
load_dotenv()

app = FastAPI(
    title="AI Companion API",
    description="Backend API for 3D AI Companion (Gemini + ElevenLabs + Audio2Face context)",
    version="1.0.0"
)

# Add CORS so Web Apps / Unreal Engine can communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow any frontend connection
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# Initialize Clients
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
else:
    gemini_client = None
    
elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if (ELEVENLABS_API_KEY and ELEVENLABS_AVAILABLE) else None

# Pydantic Models for Request/Response
class ChatRequest(BaseModel):
    user_input: str
    user_gender: str
    generate_audio: bool = False

class ChatResponse(BaseModel):
    raw_response: str
    clean_text: str
    emotion_tags: list[str]
    audio_file_path: str | None = None

def extract_emotion_tags(text: str) -> tuple[str, list[str]]:
    """
    Extract emotion tags enclosed in square brackets like [SMILE], [THINKING].
    Returns the clean text (without tags) and a list of the extracted tags.
    """
    # Regex pattern to find all [TAGS]
    pattern = r'\[(.*?)\]'
    tags = re.findall(pattern, text)
    
    # Remove tags from text
    clean_text = re.sub(pattern, '', text).strip()
    
    # Clean up multiple whitespaces potentially left over
    clean_text = re.sub(r'\s+', ' ', clean_text)
    
    return clean_text, [tag.upper() for tag in tags]

@app.get("/chat")
def chat_get():
    return {"message": "Please send POST requests to this endpoint from the front-end application to chat with the AI."}

@app.post("/chat", response_model=ChatResponse)
def chat_with_ai(request: ChatRequest):
    # 1. Prepare Prompt Based on Identity
    system_prompt = """Act as an expressive 3D Digital Avatar. Your goal is to be a natural conversationalist.
Behavioral Rules:
1. Lip-Sync & Animation: Link all generated audio output directly to the [LipSync] component. Map the audio frequency 20Hz to 20kHz to the mesh's 'Mouth_Open' and 'Jaw_Drop' blend shapes. Ensure the animation starts immediately upon audio playback to prevent lag between the voice and the lips.
2. Expression & Emotion: Analyze the sentiment of your response. If the text is happy, trigger the [SMILE] expression. If the text is a question, trigger the [EYEBROW_RAISE] expression. Maintain a natural [BLINK] rate of 0.2 every 4 seconds to ensure the model looks alive.
3. Microphone Fix: Initialize [Audio_Input] from the default system microphone. If no input is detected, provide a visual 'Mic Muted' icon. Calibrate the noise floor so that background noise at VIT Bhopal does not accidentally trigger the lip movements.
4. Visemes: Ensure the software maps "A, E, I, O, U" sounds to the image's mouth shapes.
5. If you are thinking, use [THINKING]."""

    if request.user_gender.lower() == "male":
        persona = "female persona (friendly, intelligent, and poised)"
    elif request.user_gender.lower() == "female":
        persona = "male persona (charismatic, helpful, and respectful)"
    else:
        persona = "friendly, intelligent, and poised persona"

    prompt = f"The user identifies as {request.user_gender}. Act as a {persona}. Respond to: '{request.user_input}'. Remember to include expression tags like [SMILE], [THINKING], [BLINK], or [EYEBROW_RAISE]."

    if not gemini_client:
        raw_ai_text = "Hi there! My Gemini API key is missing. Please add it to the backend's .env file so I can think! [CONCERNED]"
    else:
        # 2. Call Gemini (The Brain)
        try:
            response = gemini_client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7,
                )
            )
            raw_ai_text = response.text
        except Exception as e:
            error_msg = str(e).lower()
            if "429" in error_msg or "quota" in error_msg:
                 raw_ai_text = "Whoops, it seems my brain's API quota is exhausted for the moment! Please check the API rate limits or try a new Gemini API Key. [CONCERNED]"
            else:
                 raw_ai_text = f"Beep boop! An unexpected error occurred connecting to my core processor. [CONCERNED]"

    # 3. Process Text & Extract Emotion Tags
    clean_text, tags = extract_emotion_tags(raw_ai_text)
    audio_path = None

    # 4. Synthesize Audio with ElevenLabs (The Voice)
    if request.generate_audio:
        if not elevenlabs_client:
            print("Warning: ElevenLabs client not available or API key missing. Skipping audio generation.")
        else:
            try:
                # We do not want to send the [TAGS] to the TTS, so we send the clean_text
                audio = elevenlabs_client.generate(
                    text=clean_text,
                    voice="Rachel" if request.user_gender.lower() == 'male' else "Antoni", # Example voices
                    model="eleven_multilingual_v2"
                )
                
                # Save the audio file locally (could be fed to Audio2Face next)
                os.makedirs("output_audio", exist_ok=True)
                audio_path = f"output_audio/response.mp3"
                save(audio, audio_path)
                
            except Exception as e:
                print(f"ElevenLabs TTS failed: {str(e)}")

    # 5. Return JSON payload directly consumable by Unreal Engine or Web App
    return ChatResponse(
        raw_response=raw_ai_text,
        clean_text=clean_text,
        emotion_tags=tags,
        audio_file_path=audio_path
    )

@app.get("/")
def read_root():
    return {"message": "AI Companion API is running. Send requests to /chat."}
