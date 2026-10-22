import urllib.request
import json

url = 'http://localhost:8000/equipment-products.json'
dest_json_path = '/Users/bosreylin/my-react-site/src/data/equipment-products.json'

try:
    print(f"Fetching from {url}...")
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        data = response.read()
        
    # Let's validate it is correct JSON
    json_data = json.loads(data.decode('utf-8'))
    print(f"Successfully parsed JSON. Items count: {len(json_data)}")
    
    with open(dest_json_path, 'w', encoding='utf-8') as dest_file:
        json.dump(json_data, dest_file, indent=2)
        
    print(f"SUCCESS: Downloaded and saved database file to {dest_json_path}")
except Exception as e:
    print(f"Error fetching/saving catalog: {e}")
