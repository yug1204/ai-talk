import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load the environment variables (like GEMINI_API_KEY) from the .env file
load_dotenv()

def get_ai_response(user_input: str, user_gender: str) -> str:
    """
    Get a response from the AI companion adjusting persona based on user gender.
    
    Args:
        user_input (str): The text input from the user.
        user_gender (str): The gender identity of the user ('male', 'female', etc.).
    """
    # System prompt as defined for the AI Companion
    system_prompt = """You are a highly empathetic and professional AI companion. Your goal is to provide helpful, conversational answers to general questions from the public.

Secondary Identity:
If the user identifies as male, you adopt a female persona (friendly, intelligent, and poised). If the user identifies as female, you adopt a male persona (charismatic, helpful, and respectful).

Interaction Style: Maintain a 'human-like' flow. Do not sound like a robot. Use subtle humor and emotional intelligence. Your output must include 'emotion tags' like [SMILE], [THINKING], or [CONCERNED] anywhere in your response so the 3D model can update its facial expressions in real-time."""

    # Determine persona prompt based on user gender
    if user_gender.lower() == "male":
        persona = "female persona (friendly, intelligent, and poised)"
    elif user_gender.lower() == "female":
        persona = "male persona (charismatic, helpful, and respectful)"
    else:
        persona = "friendly, intelligent, and poised persona"

    prompt = f"The user identifies as {user_gender}. Act as a {persona}. Respond to: '{user_input}'. Remember to include expression tags like [SMILE], [THINKING], or [CONCERNED]."

    # Configure the Gemini client
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "[ERROR] GEMINI_API_KEY is not set in the .env file."

    client = genai.Client(api_key=api_key)
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
            )
        )
        return response.text
    except Exception as e:
        return f"[ERROR] Failed to communicate with Gemini: {str(e)}"

if __name__ == "__main__":
    # Example usage
    user_msg = "How do I stay productive today?"
    gender = "male"
    
    print(f"User ({gender}): {user_msg}")
    print("AI Companion thinking...")
    
    output = get_ai_response(user_msg, gender)
    print("\nResponse:")
    print(output)
