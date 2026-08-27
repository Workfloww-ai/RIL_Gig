import os
import re

files_to_update = [
    'profile.tsx',
    'payments.tsx',
    'library.tsx',
    'index.tsx'
]

replacements = [
    (r'bg-gray-50', 'bg-sand'),
    (r'bg-white', 'bg-cream'),
    (r'text-gray-900', 'text-slate'),
    (r'text-gray-500', 'text-sage'),
    (r'text-gray-400', 'text-sage'),
    (r'text-\[\#666666\]', 'text-sage'),
    (r'text-\[\#1A1A1A\]', 'text-slate'),
    (r'text-\[\#10472B\]', 'text-moss'),
    (r'bg-\[\#E31B23\]', 'bg-clay'),
    (r'bg-\[\#10472B\]', 'bg-moss'),
    (r'border-\[\#10472B\]', 'border-moss'),
    (r'border-gray-100', 'border-sage/10'),
    (r'border-gray-200', 'border-sage/20'),
    (r'bg-green-100', 'bg-moss/10'),
    (r'bg-green-50', 'bg-moss/5'),
    (r'border-green-200', 'border-moss/20'),
    (r'border-green-100', 'border-moss/10'),
    (r'text-green-600', 'text-moss'),
    (r'text-green-700', 'text-moss'),
    (r'text-green-500', 'text-moss/80'),
    (r'bg-green-600', 'bg-moss'),
    (r'bg-primary-600', 'bg-moss'),
    (r'bg-primary-700', 'bg-moss/80'),
    (r'border-primary-500', 'border-moss'),
    (r'bg-blue-50', 'bg-moss/10'),
    (r'border-blue-100', 'border-moss/20'),
    (r'bg-yellow-50', 'bg-sand'),
    (r'border-yellow-100', 'border-sage/10'),
    (r'text-yellow-700', 'text-slate'),
    (r'text-yellow-500', 'text-sage'),
    (r'bg-red-50', 'bg-clay/5'),
    (r'border-red-100', 'border-clay/10'),
    (r'text-red-600', 'text-clay'),
    (r'bg-yellow-100', 'bg-sage/10'),
    (r'bg-green-300', 'bg-moss/50'),
    (r'text-blue-500', 'text-moss/80'),
    (r'bg-clay/20', 'bg-clay/10'),
    (r'bg-blue-100', 'bg-moss/10'),
    (r'bg-\[\#FFFFFF\]', 'bg-cream'),
    (r'border-\[\#E5E7EB\]', 'border-sage/20'),
]

for filename in files_to_update:
    path = os.path.join('/Users/monalikagoel/Documents/RIL_Gig/mobile/app', filename)
    if not os.path.exists(path):
        continue
    
    with open(path, 'r') as f:
        content = f.read()
        
    for old, new in replacements:
        content = re.sub(old, new, content)
        
    with open(path, 'w') as f:
        f.write(content)

print("Updated files successfully")
