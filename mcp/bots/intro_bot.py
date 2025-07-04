#!/usr/bin/env python3
import subprocess, sys

def route_prompt(prompt):
    lower = prompt.lower()
    if "how do i code" in lower or "python" in lower or "bug" in lower:
        model = "llm_code.py"
    elif "fast" in lower or "summarize" in lower:
        model = "llm_fast.py"
    elif "lightweight" in lower or "quick" in lower:
        model = "llm_micro.py"
    elif "who are you" in lower or "hi" in lower or "help" in lower:
        model = "llm_light.py"
    else:
        model = "llm_main.py"
    return model

def greet(prompt):
    print("🤖 IntroBot: Hi there! Let me find the best system to handle this...")
    model_script = route_prompt(prompt)
    subprocess.run(["python3", model_script, prompt])

if __name__ == "__main__":
    prompt = sys.argv[1] if len(sys.argv) > 1 else input("Ask anything: ")
    greet(prompt)
