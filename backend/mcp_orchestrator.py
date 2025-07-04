import json
from backend.persona_runner import get_persona_response

# Load personas
with open("backend/persona_map.json") as f:
    personas = json.load(f)

def choose_persona():
    print("Choose a persona:")
    for key in personas:
        print(f"- {key}: {personas[key]['name']} ({personas[key]['role']})")
    choice = input("\nEnter key: ").strip().lower()
    return choice if choice in personas else None

def main():
    while True:
        persona_key = choose_persona()
        if not persona_key:
            print("Invalid choice.")
            continue

        print(f"\n[You’re chatting with {personas[persona_key]['name']} - {personas[persona_key]['role']}]\n")
        while True:
            user_input = input("You: ")
            if user_input.lower() in ['exit', 'quit', 'switch']:
                break
            response = get_persona_response(persona_key, user_input)
            print(f"{personas[persona_key]['name']}: {response}")

if __name__ == "__main__":
    main()

