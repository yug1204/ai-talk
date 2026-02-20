# 3D AI Companion - Python Backend

This repository contains the Python backend required to drive a hyper-realistic 3D AI companion (e.g., using Unreal Engine 5 MetaHumans) as well as the web interface.

## Tech Stack
*   **API Framework**: FastAPI
*   **The Brain (Logic)**: OpenAI GPT-4
*   **Voice (TTS)**: ElevenLabs API
*   **Animations (Integration)**: Emotion tags parsed for NVIDIA Audio2Face / Unreal Engine 5.

## How it Works
1.  **Input:** The backend receives a POST request containing the user's message and gender.
2.  **Processing (Brain):** GPT-4 processes the input and responds with embedded emotion tags (e.g., `[SMILE]`, `[THINKING]`). It dynamically shifts its persona based on the user's gender.
3.  **Parsing:** A RegEx engine parses out the raw text, extracting the pure spoken text and a clean array of emotion tags.
4.  **TTS (Voice):** The clean spoken text is sent to ElevenLabs to generate an `.mp3` or `.wav` file.
5.  **Output:** The backend returns a JSON object containing the `clean_text`, `emotion_tags` array, and the `audio_file_path`.

## Connecting to Unreal Engine 5
To connect this with Unreal Engine 5 and Audio2Face:
1.  Send an HTTP POST Request from Unreal Engine (using the **VaRest** plugin or Unreal HTTP module) to this local FastAPI server `http://127.0.0.gov:8000/chat`.
2.  Parse the returned JSON.
3.  Send the `audio_file_path` to NVIDIA Audio2Face (which can run locally and stream blendshapes via LiveLink).
4.  Trigger specific skeletal mesh animations or morph targets in your MetaHuman Blueprint based on the `emotion_tags` array in the JSON response.

## Setup Instructions
1.  **Clone / Download** this folder.
2.  **Create a Virtual Environment:**
    ```bash
    python -m venv venv
    venv\Scripts\activate
    ```
3.  **Install Requirements:**
    ```bash
    pip install -r requirements.txt
    ```
4.  **API Keys:** Copy `.env.example` to `.env` and fill in your OpenAI and ElevenLabs API keys.
5.  **Run the Server:**
    ```bash
    # using uvicorn
    uvicorn main:app --reload
    ```
6.  **Test the API:** Open `http://127.0.0.1:8000/docs` in your browser to interact safely with the Swagger UI.
