const fs = require('fs');
const path = require('path');

try {
  const code = fs.readFileSync(path.join(__dirname, 'src/App.jsx'), 'utf8');
  // Simple syntax check by compiling to a Function or using eval (which parses it)
  // Wait, JSX cannot be parsed by standard node, we need to strip JSX or use a compiler.
  console.log("Read App.jsx successfully, length:", code.length);
} catch (e) {
  console.error("Error:", e);
}
