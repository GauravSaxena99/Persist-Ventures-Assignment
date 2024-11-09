# server.py
from fastapi import FastAPI, WebSocket
import openai
from config import OPENAI_API_KEY
import os
import json

app = FastAPI()

# Set OpenAI API key (assume you have API keys set up in environment variables)
openai.api_key = OPENAI_API_KEY

@app.websocket("/ws/audio_stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected")

    try:
        while True:
            # Receive audio data from the client
            audio_bytes = await websocket.receive_bytes()

            # Process audio: Convert audio to text
            transcript = await convert_audio_to_text(audio_bytes)

            # Get the LLM's response
            if transcript:
                response_text = await get_llm_response(transcript)
                # Send back the response
                await websocket.send_text(json.dumps({"response": response_text}))
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await websocket.close()
        print("Client disconnected")

async def convert_audio_to_text(audio_bytes):
    # Use Whisper API to transcribe audio to text
    response = openai.Audio.transcribe(
        model="whisper-1",  # Replace with the Whisper API model name
        file=audio_bytes
    )
    return response.get("text", "")

async def get_llm_response(transcript):
    # Send the transcript to the GPT-4 model and get response
    response = openai.Completion.create(
        model="gpt-4o",  # Use "GPT-4O" or "GPT-4O-mini" as per assignment
        prompt=transcript,
        max_tokens=50
    )
    return response.choices[0].text.strip()
