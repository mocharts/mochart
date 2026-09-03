#!/usr/bin/env node
// Records the README animation clips. See README.md beside this file.
//
// Serves the repo root over HTTP (the page imports the built @mochart/core
// bundle as an ES module, which file:// cannot do), opens record.html in
// Chromium with Playwright video recording on, runs one scene per theme, and
// converts each clip to a looping GIF plus an MP4 with ffmpeg.
//
// Usage:
//   node scripts/readme-gif/record.mjs <outDir> [options]
//
// Options:
//   --scene <name>   record only this scene (default: every scene in scenes.mjs)
//   --theme <name>   light or dark (default: both)
//   --fps <n>        GIF frame rate (default 20)
//   --width <px>     GIF width; the MP4 keeps the recorded 2x size (default 800)
//   --keep-video     keep the raw .webm next to the outputs

import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scenes } from './scenes.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(here, '..', '..');
const SCALE = 2;
const distBundle = join(repoRoot, 'packages', 'mochart', 'dist', 'mochart.js');

function parseArgs(argv) {
  const options = { outDir: null, scene: null, theme: null, fps: 20, width: 800, keepVideo: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--scene': options.scene = argv[++index]; break;
      case '--theme': options.theme = argv[++index]; break;
      case '--fps': options.fps = Number(argv[++index]); break;
      case '--width': options.width = Number(argv[++index]); break;
      case '--keep-video': options.keepVideo = true; break;
      default:
        if (arg.startsWith('--') || options.outDir !== null) {
          throw new Error(`unexpected argument ${arg}`);
        }
        options.outDir = resolve(arg);
    }
  }
  if (options.outDir === null) {
    throw new Error('usage: record.mjs <outDir> [--scene name] [--theme light|dark] [--fps n] [--width px] [--keep-video]');
  }
  return options;
}

const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };

function serveRepo() {
  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    const file = join(repoRoot, path);
    if (!file.startsWith(repoRoot) || !existsSync(file) || statSync(file).isDirectory()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => resolveServer({ server, port: server.address().port }));
  });
}

async function recordClip(browser, port, scene, theme, outDir, options) {
  const { width, height } = scene;
  const videoDir = join(outDir, `.video-${scene.name}-${theme}`);
  rmSync(videoDir, { recursive: true, force: true });
  // The video is captured at viewport size, so the page scales the chart up by
  // SCALE inside a SCALE-times-larger viewport and ffmpeg scales it back down.
  const context = await browser.newContext({
    viewport: { width: width * SCALE, height: height * SCALE },
    colorScheme: theme,
    reducedMotion: 'no-preference',
    recordVideo: { dir: videoDir, size: { width: width * SCALE, height: height * SCALE } }
  });
  const marks = {};
  const page = await context.newPage();
  const videoStart = Date.now();
  await page.exposeFunction('__sceneMark', (name) => { marks[name] = Date.now(); });
  page.on('pageerror', (error) => { throw error; });
  await page.goto(`http://127.0.0.1:${port}/scripts/readme-gif/record.html?scene=${scene.name}&theme=${theme}&scale=${SCALE}`);
  await page.waitForFunction(() => window.__sceneReady === true);
  await page.evaluate(() => window.runScene());
  const videoPath = await page.video().path();
  await context.close();

  const stem = join(outDir, `${scene.name}-${theme}`);
  const trimSeconds = Math.max(0, marks.start - videoStart) / 1000;
  const durationSeconds = (marks.end - marks.start) / 1000;
  const common = ['-y', '-loglevel', 'error', '-ss', trimSeconds.toFixed(3), '-t', durationSeconds.toFixed(3), '-i', videoPath];
  const gifFilter = `fps=${options.fps},scale=${options.width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`;
  execFileSync('ffmpeg', [...common, '-vf', gifFilter, '-loop', '0', `${stem}.gif`], { stdio: 'inherit' });
  execFileSync('ffmpeg', [...common, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', `${stem}.mp4`], { stdio: 'inherit' });
  if (options.keepVideo) {
    renameSync(videoPath, `${stem}.webm`);
  }
  rmSync(videoDir, { recursive: true, force: true });
  return { gif: `${stem}.gif`, mp4: `${stem}.mp4`, seconds: durationSeconds };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(distBundle)) {
    throw new Error(`${distBundle} is missing; run "npm run build -w @mochart/core" first`);
  }
  const sceneNames = options.scene === null ? Object.keys(scenes) : [options.scene];
  const themes = options.theme === null ? ['light', 'dark'] : [options.theme];
  for (const name of sceneNames) {
    if (scenes[name] === undefined) {
      throw new Error(`unknown scene "${name}"; known: ${Object.keys(scenes).join(', ')}`);
    }
  }
  mkdirSync(options.outDir, { recursive: true });
  const { server, port } = await serveRepo();
  const browser = await chromium.launch();
  try {
    for (const name of sceneNames) {
      for (const theme of themes) {
        const result = await recordClip(browser, port, { name, ...scenes[name] }, theme, options.outDir, options);
        const kb = Math.round(statSync(result.gif).size / 1024);
        console.log(`${result.gif}  ${result.seconds.toFixed(1)}s  ${kb} KB`);
      }
    }
  }
  finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
