import json

with open('/Users/bosreylin/my-react-site/src/data/equipment-products.json', 'r') as f:
    laravel_products = json.load(f)

# Attachments filter
attachments = [p for p in laravel_products if p.get('category') in ['Mini Excavator Attachments', 'Skid Steer Attachments']]

print(f"Total attachments: {len(attachments)}")

names = {}
for idx, a in enumerate(attachments):
    name = a.get('name', '').strip()
    if name in names:
        names[name].append(idx)
    else:
        names[name] = [idx]

dup_count = 0
for name, idxs in names.items():
    if len(idxs) > 1:
        print(f"Duplicate attachment: '{name}' at indices {idxs}")
        dup_count += 1

if dup_count == 0:
    print("No duplicate attachment names found in JSON.")
