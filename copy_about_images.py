import os
import shutil

src_dir = '/Users/bosreylin/.gemini/antigravity-ide/brain/7b62cf1d-d176-4f60-9f12-c4a97d4e76f8'
dest_dir = '/Users/bosreylin/my-react-site/src/assets'

images = {
    'typhon_factory_engineer_1781844631084.png': 'typhon_factory_engineer.png',
    'loader_carrying_gravel_1781844646662.png': 'loader_carrying_gravel.png',
    'track_loader_farm_1781844661808.png': 'track_loader_farm.png',
    'dumper_construction_1781844680308.png': 'dumper_construction.png',
    'tiger_watermark_1781844692905.png': 'tiger_watermark.png',
    'tiger_logo_1781844708986.png': 'tiger_logo.png'
}

for src_name, dest_name in images.items():
    src_path = os.path.join(src_dir, src_name)
    dest_path = os.path.join(dest_dir, dest_name)
    if os.path.exists(src_path):
        shutil.copy2(src_path, dest_path)
        print(f"Copied: {src_name} -> {dest_name}")
    else:
        print(f"ERROR: {src_name} not found!")

print("Done!")
