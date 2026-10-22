import os
import shutil

# Paths
brain_dir = '/Users/bosreylin/.gemini/antigravity-ide/brain/5a8fe0b8-9eb5-481b-b7c3-269398920a37'
laravel_json = '/Users/bosreylin/Wheel-Loader/public/equipment-products.json'

dest_assets_dir = '/Users/bosreylin/my-react-site/src/assets/products'
dest_data_dir = '/Users/bosreylin/my-react-site/src/data'

# Ensure directories exist
os.makedirs(dest_assets_dir, exist_ok=True)
os.makedirs(dest_data_dir, exist_ok=True)

# Image mapping: (brain filename, project filename)
images = [
    ('media__1781571214974.png', 'grand-ripper.png'),
    ('media__1781571247719.png', 'kuvuo.png'),
    ('media__1781571261113.png', 'skoop-ii.png'),
    ('media__1781571273557.png', 'spider-one.png'),
    ('media__1781571287677.png', 'stomp-v950.png')
]

# 1. Copy images
for src_name, dest_name in images:
    src_path = os.path.join(brain_dir, src_name)
    dest_path = os.path.join(dest_assets_dir, dest_name)
    if os.path.exists(src_path):
        shutil.copy2(src_path, dest_path)
        print(f"Copied image {src_name} -> {dest_name}")
    else:
        print(f"WARNING: Image {src_name} not found in brain directory!")

# 2. Copy JSON file
dest_json_path = os.path.join(dest_data_dir, 'equipment-products.json')
if os.path.exists(laravel_json):
    shutil.copy2(laravel_json, dest_json_path)
    print(f"Copied database file: {laravel_json} -> {dest_json_path}")
else:
    print(f"WARNING: Laravel json database {laravel_json} not found!")

print("All copies completed!")

