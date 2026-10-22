import subprocess
import os

os.chdir('/Users/bosreylin/my-react-site')
res = subprocess.run(['git', 'diff'], capture_output=True, text=True)
print("STDOUT:")
print(res.stdout)
print("STDERR:")
print(res.stderr)
