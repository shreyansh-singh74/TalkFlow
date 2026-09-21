# Taste
- Prefers step-by-step instructions and plain-language explanations over jargon ("tell in simple", "give me the steps step by step"). Confidence: 0.9
- Prefers a written plan before implementation; frequently uses `/plan` or asks for a plan first before code changes. Confidence: 0.9
- Prefers the assistant to make the decisive technical recommendation rather than present a menu of options (e.g. "choose the best one"). Confidence: 0.8
- Cost-conscious about cloud spend; wants minimal instance requirements and credit/runway estimates before deploying. Confidence: 0.8
- Deploys the FastAPI backend to AWS Lightsail behind nginx, run as a systemd service with uvicorn on 127.0.0.1:8000. Confidence: 0.7
- Cares about visual polish and uses reference sites (Wispr Flow, pyannote.ai, Google Dictionary) as design inspiration. Confidence: 0.7
- Wants runnable verification steps (scripts/tests) to check work themselves. Confidence: 0.7
- Uses terse "continue" to resume long-running work without recap. Confidence: 0.6
