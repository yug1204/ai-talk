import requests

url = "http://127.0.0.1:8000/chat"
payload = {
  "user_input": "Hi! Can you introduce yourself and tell me what we are doing today?",
  "user_gender": "male",
  "generate_audio": False
}
headers = {
    "accept": "application/json",
    "Content-Type": "application/json"
}

print("Sending request to AI Companion Server...")
try:
    response = requests.post(url, json=payload, headers=headers)
    print("\nStatus Code:", response.status_code)
    print("Response JSON:\n", response.json())
except Exception as e:
    print(f"Failed to connect to the server: {e}")
