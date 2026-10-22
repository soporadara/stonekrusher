import os
import shutil

src_dir = "/Users/bosreylin/.gemini/antigravity-ide/brain/4bfa756a-9a22-45f2-896f-1a97165b1fb0/.tempmediaStorage"
dest_dir = "/Users/bosreylin/my-react-site/src/assets/products"

print(f"Source directory: {src_dir}")
print(f"Destination directory: {dest_dir}")

if not os.path.exists(src_dir):
    print("ERROR: Source directory does not exist!")
    exit(1)

# Ensure dest dir exists
os.makedirs(dest_dir, exist_ok=True)

# List all files in the source directory
all_files = os.listdir(src_dir)
print(f"Total files in source directory: {len(all_files)}")

# Filter files that match our session pattern and are PNGs
session_prefix = "media_4bfa756a-9a22-45f2-896f-1a97165b1fb0_"
matching_files = [f for f in all_files if f.startswith(session_prefix) and f.endswith(".png")]

# Sort matching files by their suffix numbers (timestamps)
# Filename format: media_4bfa756a-9a22-45f2-896f-1a97165b1fb0_TIMESTAMP.png
def get_timestamp(filename):
    try:
        parts = filename.split("_")
        timestamp_part = parts[-1].replace(".png", "")
        return int(timestamp_part)
    except Exception:
        return 0

matching_files.sort(key=get_timestamp)

# We are looking for the files uploaded recently (with timestamp starting with 178235)
recent_files = [f for f in matching_files if "178235" in f]
print(f"Found {len(recent_files)} recent files matching pattern:")
for f in recent_files:
    print(f" - {f} (size: {os.path.getsize(os.path.join(src_dir, f))} bytes)")

# Map recent files to destination names
# 1. First uploaded (1782352985876) -> about-skoop-park.png
# 2. Second uploaded (1782352994443) -> about-skoop-building.png
# 3. Third uploaded (1782353000781) -> about-skoop-dirt.png
mapping = [
    ("about-skoop-park.png", "park layout"),
    ("about-skoop-building.png", "building site"),
    ("about-skoop-dirt.png", "dirt layout")
]

# Perform copy
copied_count = 0
for i, (dest_name, desc) in enumerate(mapping):
    if i < len(recent_files):
        src_name = recent_files[i]
        src_path = os.path.join(src_dir, src_name)
        dest_path = os.path.join(dest_dir, dest_name)
        
        try:
            shutil.copy2(src_path, dest_path)
            print(f"Copied: {src_name} -> {dest_name} ({desc})")
            copied_count += 1
        except Exception as e:
            print(f"ERROR copying {src_name} to {dest_name}: {e}")
    else:
        print(f"WARNING: No source file available for mapping index {i} ({dest_name})")

print(f"Copy process completed. Successfully copied {copied_count} files.")
if copied_count < 3:
    print("\nIf some files are missing, here are some other recent files in the source directory:")
    for f in sorted(all_files):
        if "178234" in f or "178235" in f:
            print(f" - {f}")
