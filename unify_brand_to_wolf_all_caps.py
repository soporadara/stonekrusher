import os
import re

def rebrand_content(content):
    # Perform standard replacements for the brand name
    content = content.replace("Wolf Heavy Machinery", "WOLF")
    content = content.replace("Wolf Machinery", "WOLF")
    content = content.replace("Wolf Equipment", "WOLF")
    
    # Specific contextual replacements
    content = content.replace("Wolf Blog", "WOLF Blog")
    content = content.replace("Wolf blog", "WOLF Blog")
    content = content.replace("About Wolf", "About WOLF")
    content = content.replace("View All Wolf", "View All WOLF")
    content = content.replace("At Wolf,", "At WOLF,")
    content = content.replace("does Wolf", "does WOLF")
    content = content.replace("Wolf offers", "WOLF offers")
    content = content.replace("Are Wolf", "Are WOLF")
    content = content.replace("upgrading to Wolf", "upgrading to WOLF")
    content = content.replace("<span>Wolf</span>", "<span>WOLF</span>")
    content = content.replace("'Wolf': 'Wolf'", "'Wolf': 'WOLF'")
    content = content.replace("alt=\"Wolf Heavy Machinery\"", "alt=\"WOLF\"")
    content = content.replace("alt=\"Wolf Heavy Wheel Loader\"", "alt=\"WOLF Heavy Wheel Loader\"")
    content = content.replace("alt=\"Wolf Stone Crusher\"", "alt=\"WOLF Stone Crusher\"")
    content = content.replace("alt=\"Wolf customer service team\"", "alt=\"WOLF customer service team\"")
    content = content.replace("title=\"Wolf Location Map\"", "title=\"WOLF Location Map\"")
    content = content.replace("alt=\"Wolf Brand Logo\"", "alt=\"WOLF Brand Logo\"")
    content = content.replace("about Wolf machinery", "about WOLF machinery")
    content = content.replace("about Wolf Heavy Machinery", "about WOLF")
    content = content.replace("about Wolf", "about WOLF")
    content = content.replace("official Wolf heavy machinery", "official WOLF heavy machinery")
    content = content.replace("Learn about Wolf", "Learn about WOLF")
    content = content.replace("with the Wolf sales", "with the WOLF sales")
    content = content.replace("Review selected Wolf", "Review selected WOLF")
    content = content.replace("from Wolf Machinery", "from WOLF")
    content = content.replace("for Wolf product data", "for WOLF product data")
    content = content.replace("Read Wolf machinery", "Read WOLF machinery")
    content = content.replace("excavator-maintenance-tips | Wolf", "excavator-maintenance-tips | WOLF")
    
    # Let's clean up key content references in lists or comments
    content = content.replace("Welcome to WOLF service and support", "Welcome to WOLF service and support")
    content = content.replace("Heavy Machinery Inventory | Wolf", "Heavy Machinery Inventory | WOLF")
    content = content.replace("Help Center & Topics | Wolf", "Help Center & Topics | WOLF")
    content = content.replace("Service & Support | Wolf", "Service & Support | WOLF")
    content = content.replace("Contact Us | Wolf", "Contact Us | WOLF")
    content = content.replace("Product Cart | Wolf", "Product Cart | WOLF")
    content = content.replace("Checkout ${checkoutItem.name} | Wolf", "Checkout ${checkoutItem.name} | WOLF")
    content = content.replace("${selectedProduct.name} | Wolf", "${selectedProduct.name} | WOLF")
    
    return content

# Read and update App.jsx
app_jsx_path = 'src/App.jsx'
with open(app_jsx_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = rebrand_content(content)
if new_content != content:
    with open(app_jsx_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated src/App.jsx")
else:
    print("No changes in src/App.jsx")

# Read and update index.html
index_html_path = 'index.html'
with open(index_html_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = rebrand_content(content)
if new_content != content:
    with open(index_html_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated index.html")
else:
    print("No changes in index.html")

# Also let's update public/robots.txt sitemap url to be consistent
robots_path = 'public/robots.txt'
if os.path.exists(robots_path):
    with open(robots_path, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = content.replace("https://konstructzmachinery.com/sitemap.xml", "https://wolfmachinery.com/sitemap.xml")
    if new_content != content:
        with open(robots_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Successfully updated public/robots.txt")
