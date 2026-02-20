# Unreal Engine 5 (MetaHuman) Integration Guide

If you want to move your AI from the abstract Web App we just created to a **photorealistic MetaHuman in Unreal Engine**, here is your exact technical roadmap.

### 1. The Unreal Engine Setup
To hook Unreal Engine 5 up to your running Python Brain (`http://127.0.0.1:8000/chat`), you need to use Unreal's built-in HTTP module or a free plugin called **VaRest**.

1. Download the free "VaRest" plugin from the UE5 Marketplace.
2. In your MetaHuman Blueprint, add a Node called **`Construct JSON Object`**.
3. Add a Node called **`Set String Field`**. Set the Field Name to `"user_input"` and pass the output of whatever your player typed in a UMG Widget.
4. Call **`Apply URL`** node.
    - Set URL to: `http://127.0.0.1:8000/chat`
    - Verb: `POST`
    - Content Type: `application/json`
5. Bind an event to **`On Request Complete`**.
6. When complete, use **`Get Field`** to grab the `"emotion_tags"` JSON Array. 
7. Loop through those tags and use a Switch statement to activate specific Morph Targets or Animation Montages (e.g., if array contains "SMILE", blend weight of `facs_smile_left` / `right` to 1.0).

### 2. The Voice & Lip Sync Setup (NVIDIA Audio2Face)
If you just play the `.mp3` we got from ElevenLabs, the mouth won't move. You need NVIDIA's Generative AI. 

1. Download **NVIDIA Omniverse** and install **Audio2Face**.
2. Put our Python `.mp3` output file directly into Audio2Face via its REST API (Audio2Face has a local API on port `8011`).
3. Audio2Face will automatically generate facial animation curves based on the volume and emotion of the AI's voice.
4. Inside Audio2Face, click **"Stream to Unreal Engine"** (Requires the Omniverse LiveLink plugin installed in UE5).
5. In Unreal Engine, add a **LiveLink Face Component** to your MetaHuman Blueprint and set its source to the Audio2Face stream.

Your MetaHuman will now perfectly lip-sync the ElevenLabs voice and activate custom body animations/expressions based on the GPT-4/Gemini tags!

### Python Bridge (Audio2Face Integration Script Placeholder)
If you decide to proceed with Option 1 later, you will create a secondary Python script that simply acts as a middleman. It will:
1. Wait for FastAPI to say `audio_file_path = "response.mp3"`.
2. Grab `response.mp3`.
3. Use a library like `requests` or `grpc` to automatically squirt that MP3 over to Audio2Face.
4. Audio2Face handles the rest.
