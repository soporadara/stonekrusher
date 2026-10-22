with open('/Users/bosreylin/.gemini/antigravity-ide/brain/5a8fe0b8-9eb5-481b-b7c3-269398920a37/.system_generated/logs/transcript.jsonl', 'r') as f:
    lines = f.readlines()
for line in lines[-5:]:
    print(line[:300] + "...")
