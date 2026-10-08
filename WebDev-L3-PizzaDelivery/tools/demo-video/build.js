// Turns raw.webm + scenes.json into the final H.264 MP4 with one drawtext caption per scene.
// Usage: node build.js <recordDir> <outputMp4>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const DIR = path.resolve(process.argv[2]);
const OUTPUT = path.resolve(process.argv[3]);
const { scenes } = JSON.parse(fs.readFileSync(path.join(DIR, 'scenes.json'), 'utf8'));
const FONT = 'C\\:/Windows/Fonts/segoeui.ttf';

// Wrap a caption to ~70 characters per line so it fits the 1280 px frame.
const wrap = (s, n = 70) => {
  const out = [];
  let line = '';
  for (const w of s.split(' ')) {
    if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out.join('\n');
};

const filters = scenes.map((s, i) => {
  const file = path.join(DIR, `caption-${i}.txt`);
  fs.writeFileSync(file, wrap(s.caption));
  const ff = file.replace(/\\/g, '/').replace(':', '\\:');
  return `drawtext=fontfile='${FONT}':textfile='${ff}':fontsize=26:fontcolor=white:box=1:boxcolor=black@0.72:boxborderw=14:line_spacing=6:x=(w-text_w)/2:y=h-text_h-34:enable='between(t,${s.start.toFixed(2)},${s.end.toFixed(2)})'`;
});

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
execFileSync(ffmpeg, ['-y', '-i', path.join(DIR, 'raw.webm'), '-vf', filters.join(','), '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '25', '-movflags', '+faststart', '-an', OUTPUT], { stdio: 'inherit' });
console.log('written', OUTPUT, (fs.statSync(OUTPUT).size / 1048576).toFixed(1), 'MB');
