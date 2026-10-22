import os
import shutil

# Dynamic paths using expanduser to avoid hardcoded absolute paths in script
home = os.path.expanduser('~')
laravel_json = os.path.join(home, 'Wheel-Loader', 'public', 'equipment-products.json')
dest_json_path = os.path.join('/Users/bosreylin/my-react-site/src/data', 'equipment-products.json')

print(f"Source: {laravel_json}")
print(f"Destination: {dest_json_path}")

try:
    if os.path.exists(laravel_json):
        shutil.copy2(laravel_json, dest_json_path)
        print("Successfully copied JSON database!")
    else:
        print("Source file does not exist.")
except Exception as e:
    print(f"Error copying: {e}")
