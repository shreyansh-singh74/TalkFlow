from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

class RespondRequest(BaseModel):
    text: str

app = FastAPI()

# Allow the web app to call the backend during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to specific origin(s) in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Hello World"};

@app.get("/agents")
async def get_agents():
    return {"agents": ["agent1", "agent2", "agent3"]}


@app.post("/api/respond")
async def respond(req: RespondRequest):
    user_text = req.text.strip()
    if not user_text:
        return {"response": "I didn't catch anything. Could you try again?"}

    # Stub: Replace with Gemini API call later
    ai_text = f"Gemini (mock) says: You said — '{user_text}'."
    return {"response": ai_text}