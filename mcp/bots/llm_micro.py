#!/usr/bin/env python3
import subprocess, sys

def run_llm(prompt):
    cmd = ['ollama', 'run', 'tinyllama:1.1b-chat']
    process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, _ = process.communicate(prompt.encode())
    print(stdout.decode())

if __name__ == "__main__":
    prompt = sys.argv[1] if len(sys.argv) > 1 else input("Prompt: ")
    run_llm(prompt)
