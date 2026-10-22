import urllib.request
import json
import os

url = 'http://localhost:8000/equipment-products.json'
dest_path = 'src/data/equipment-products.json'

try:
    print(f"Fetching {url}...")
    with urllib.request.urlopen(url) as response:
        data = response.read()
        # Parse to ensure it is valid JSON
        json_data = json.loads(data.decode('utf-8'))
        
        # Write to destination
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        print(f"Successfully downloaded and saved {len(json_data)} products to {dest_path}")
except Exception as e:
    print(f"Error downloading catalog: {e}")
