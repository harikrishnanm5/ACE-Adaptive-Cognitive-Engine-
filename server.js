import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001; // Running on a different port than Vite

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve generated PPTX files
app.use('/output', express.static(path.join(__dirname, 'output')));

app.post('/api/generate-ppt', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).send('No Python code provided.');

  // Basic Security Check: Prevent dangerous imports or system calls
  const forbiddenKeywords = ['import os', 'import subprocess', 'import sys', 'import shutil', 'getattr(', 'eval(', 'exec(', 'open(', 'write(', 'remove(', 'system('];
  const foundKeyword = forbiddenKeywords.find(keyword => code.includes(keyword));
  
  if (foundKeyword) {
    console.error(`Rejected potentially malicious Python code: contains "${foundKeyword}"`);
    return res.status(403).send(`Security Alert: The generated code contains forbidden keyword "${foundKeyword}". Execution blocked.`);
  }

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const scriptId = Math.random().toString(36).substring(7);
  const scriptPath = path.join(outputDir, `ppt_${scriptId}.py`);
  const pptxFilename = `presentation_${scriptId}.pptx`;
  const pptxPath = path.join(outputDir, pptxFilename).replace(/\\/g, '/');

  // In the Python code, replace any generic output filename with our specific path
  const finalCode = code.replace(/['"](.*\.pptx)['"]/g, `'${pptxPath}'`);

  fs.writeFile(scriptPath, finalCode, (err) => {
    if (err) return res.status(500).send('Failed to write script.');

    exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Python execution error: ${stderr}`);
        return res.status(500).send(`Python Error: ${stderr}`);
      }

      // Cleanup: Delete the script after execution
      fs.unlink(scriptPath, () => {});

      if (fs.existsSync(pptxPath)) {
        const downloadUrl = `http://localhost:${port}/output/${pptxFilename}`;
        res.json({ success: true, downloadUrl });
      } else {
        res.status(500).send('PPTX file was not generated.');
      }
    });
  });
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
