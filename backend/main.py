from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"};

@app.get("/agents")
async def get_agents():
    return {"agents": ["agent1", "agent2", "agent3"]}

