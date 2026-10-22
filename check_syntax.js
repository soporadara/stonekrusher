import fs from 'node:fs/promises';
import { transformWithOxc } from 'vite';

try {
  const source = await fs.readFile('src/App.jsx', 'utf8');
  await transformWithOxc(source, 'src/App.jsx', {
    lang: 'jsx',
    jsx: { runtime: 'automatic' }
  });
  console.log('SUCCESS: src/App.jsx compiles correctly.');
} catch (error) {
  console.error('COMPILE ERROR DETECTED:');
  console.error(error);
  process.exitCode = 1;
}
