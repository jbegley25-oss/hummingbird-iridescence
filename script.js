const canvas = document.querySelector("#feather-field");
const ctx = canvas.getContext("2d", { alpha: false });

const pointer = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  active: false,
  down: false,
  lastMove: 0,
};

const colorMemory = [];
let feathers = [];
let width = 0;
let height = 0;
let dpr = 1;
let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let mobileViewport = false;
let lastInputWasTouch = false;
let lastMemory = 0;

function isMobileViewport() {
  return window.innerWidth <= 720 || window.innerHeight <= 560;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hsl(h, s, l, a = 1) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

function addColorMemory(x, y, strength = 1) {
  colorMemory.push({
    x,
    y,
    strength,
    age: 0,
  });

  if (colorMemory.length > 32) {
    colorMemory.shift();
  }
}

function resize() {
  mobileViewport = isMobileViewport();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.floor(window.innerWidth);
  height = Math.floor(window.innerHeight);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  pointer.x = pointer.targetX = width * 0.58;
  pointer.y = pointer.targetY = height * 0.48;
  buildFeathers();
}

function buildFeathers() {
  feathers = [];
  const scale = clamp(width / 1280, 0.68, 1.18);
  const featherW = 35 * scale;
  const featherH = 65 * scale;
  const xGap = featherW * 0.58;
  const yGap = featherH * 0.36;
  const rows = Math.ceil(height / yGap) + 5;
  const cols = Math.ceil(width / xGap) + 8;

  for (let row = -3; row < rows; row += 1) {
    for (let col = -4; col < cols; col += 1) {
      const offset = row % 2 ? xGap * 0.5 : 0;
      const jitterX = Math.sin(row * 1.7 + col * 0.9) * xGap * 0.16;
      const jitterY = Math.cos(row * 0.8 + col * 1.1) * yGap * 0.18;
      const x = col * xGap + offset + jitterX;
      const y = row * yGap + jitterY;
      const bias = Math.sin(col * 0.57) * 0.5 + Math.cos(row * 0.43) * 0.5;
      feathers.push({
        x,
        y,
        w: featherW * mix(0.8, 1.22, Math.abs(Math.sin(row + col))),
        h: featherH * mix(0.88, 1.28, Math.abs(Math.cos(row * 0.45 - col))),
        angle: Math.sin(row * 0.62 + col * 0.31) * 0.22,
        bias,
        microAngle: Math.sin(row * 1.21 + col * 0.77),
        seed: Math.random(),
      });
    }
  }

  feathers.sort((a, b) => a.y - b.y);
}

function drawBackground(time) {
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#070706");
  base.addColorStop(0.46, "#1f1c18");
  base.addColorStop(1, "#0b0a08");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 72; i += 1) {
    const y = ((i * 47 + time * 0.006) % (height + 120)) - 60;
    const x = (Math.sin(i * 9.2) * 0.5 + 0.5) * width;
    ctx.fillStyle = i % 2 ? "rgba(238, 232, 219, 0.022)" : "rgba(42, 36, 30, 0.14)";
    ctx.fillRect(x - width * 0.55, y, width * 1.1, 1);
  }
  ctx.restore();
}

function drawFeather(feather, time) {
  const dx = feather.x - pointer.x;
  const dy = feather.y - pointer.y;
  const distance = Math.hypot(dx, dy);
  const touchActive = mobileViewport && lastInputWasTouch;
  const activeTouchPress = touchActive && pointer.down;
  const interaction = touchActive ? (activeTouchPress ? 1 : 0) : 1;
  const range = Math.max(145, Math.min(220, Math.max(width, height) * 0.13));
  const cursorWave = Math.max(0, 1 - distance / range);
  const pointerAngle = (pointer.x / width - 0.5) * 3.2 + (pointer.y / height - 0.5) * 1.4;
  const waveFront = distance * 0.032 - time * 0.0064;
  const angleMatch = (Math.cos(pointerAngle + feather.microAngle * 1.25 + feather.bias * 0.7) + 1) * 0.5;
  const travelingBand = (Math.cos(waveFront + feather.bias * 2.4) + 1) * 0.5;
  const plateAlignment = smoothstep(0.74, 0.9, angleMatch * 0.74 + travelingBand * 0.42);
  const directional = Math.sin(dx * 0.018 - dy * 0.012 + time * 0.0022 + feather.bias * 3);
  const cursorMask = smoothstep(0.02, 0.32, cursorWave);
  let shimmer = Math.pow(cursorWave, 1.85) * plateAlignment * 1.65 * interaction;

  const memoryRadius = range * 0.82;
  for (const memory of colorMemory) {
    const md = Math.hypot(feather.x - memory.x, feather.y - memory.y);
    const memoryWave = Math.max(0, 1 - md / memoryRadius);
    const memoryFade = Math.pow(1 - memory.age, 1.65) * memory.strength;
    shimmer += Math.pow(memoryWave, 2.15) * memoryFade * 0.58;
  }

  const flare = clamp(smoothstep(0.18, 0.38, shimmer) * Math.max(cursorMask, smoothstep(0.04, 0.24, shimmer) * 0.78), 0, 1);
  const colorSplit = smoothstep(0.45, 0.9, travelingBand + feather.microAngle * 0.08);
  const blueSplit = smoothstep(0.7, 1, travelingBand - feather.microAngle * 0.12);
  const centerMagenta = smoothstep(0.68, 0.98, cursorWave) * smoothstep(0.36, 0.88, flare);
  const magenta = 322 + Math.sin(feather.bias + time * 0.0008) * 7;
  const emerald = 139 + Math.cos(feather.bias * 1.7 + time * 0.0007) * 16;
  const cyanBlue = 188 + Math.sin(feather.bias * 1.2 + time * 0.0009) * 26;
  const coolHue = mix(emerald, cyanBlue, blueSplit);
  const hue = mix(coolHue, magenta, centerMagenta * 0.94);
  const restingHue = mix(24, 58, feather.seed * 0.45);
  const sat = mix(5, centerMagenta > 0.45 ? 100 : 98, flare);
  const light = mix(12 + feather.seed * 9, centerMagenta > 0.45 ? 70 : 63, flare);

  ctx.save();
  ctx.translate(feather.x, feather.y);
  ctx.rotate(feather.angle + directional * flare * 0.16);

  const gradient = ctx.createLinearGradient(0, -feather.h * 0.45, 0, feather.h * 0.48);
  gradient.addColorStop(0, hsl(mix(restingHue, hue, flare), sat, light + 8, 0.96));
  gradient.addColorStop(0.5, hsl(mix(restingHue + 6, hue + 16, flare), sat, light, 0.98));
  gradient.addColorStop(1, hsl(mix(restingHue - 12, hue - 24, flare), sat, light - 12, 0.98));

  ctx.beginPath();
  ctx.moveTo(0, -feather.h * 0.5);
  ctx.bezierCurveTo(feather.w * 0.56, -feather.h * 0.28, feather.w * 0.55, feather.h * 0.24, 0, feather.h * 0.52);
  ctx.bezierCurveTo(-feather.w * 0.55, feather.h * 0.24, -feather.w * 0.56, -feather.h * 0.28, 0, -feather.h * 0.5);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = smoothstep(0.18, 0.62, flare) * 0.96;
  ctx.fillStyle = hsl(hue + 8, 100, centerMagenta > 0.45 ? 76 : 68, 0.9);
  ctx.beginPath();
  ctx.ellipse(-feather.w * 0.12, -feather.h * 0.05, feather.w * 0.18, feather.h * 0.46, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = smoothstep(0.48, 0.82, flare) * 0.78;
  ctx.fillStyle = "rgba(255, 246, 244, 0.82)";
  ctx.beginPath();
  ctx.ellipse(feather.w * 0.13, -feather.h * 0.28, feather.w * 0.08, feather.h * 0.2, -0.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.28 + flare * 0.32;
  ctx.strokeStyle = flare > 0.2 ? hsl(hue + 35, 100, 82, 0.88) : "rgba(232, 225, 208, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -feather.h * 0.42);
  ctx.lineTo(0, feather.h * 0.45);
  ctx.stroke();

  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = flare > 0.35 ? hsl(hue - 36, 94, 40, 0.42) : "rgba(30, 25, 18, 0.35)";
  for (let i = -3; i <= 3; i += 1) {
    const offset = i * feather.w * 0.095;
    ctx.beginPath();
    ctx.moveTo(offset, -feather.h * 0.28);
    ctx.quadraticCurveTo(offset * 1.4, feather.h * 0.08, offset * 0.5, feather.h * 0.36);
    ctx.stroke();
  }

  ctx.restore();

  return flare;
}

function drawGlow(time) {
  if (lastInputWasTouch && !pointer.down && !colorMemory.length) {
    return;
  }

  const radius = Math.max(150, Math.min(225, Math.max(width, height) * 0.13));
  const glow = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
  glow.addColorStop(0, "rgba(255, 0, 190, 0.22)");
  glow.addColorStop(0.18, "rgba(86, 255, 235, 0.12)");
  glow.addColorStop(0.42, "rgba(15, 255, 106, 0.035)");
  glow.addColorStop(0.72, "rgba(0, 0, 0, 0)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = "rgba(241, 255, 234, 0.34)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i += 1) {
    const r = 34 + i * 36 + Math.sin(time * 0.003 + i) * 5;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function draw(time = 0) {
  pointer.x += (pointer.targetX - pointer.x) * 0.52;
  pointer.y += (pointer.targetY - pointer.y) * 0.52;

  drawBackground(time);

  colorMemory.forEach((memory) => {
    memory.age += reducedMotion ? 0.07 : 0.042;
  });
  while (colorMemory.length && colorMemory[0].age >= 1) {
    colorMemory.shift();
  }

  let flareTotal = 0;
  for (const feather of feathers) {
    flareTotal += drawFeather(feather, time);
  }

  drawGlow(time);

  requestAnimationFrame(draw);
}

function updatePointer(event) {
  const point = event.touches ? event.touches[0] : event;
  const wasActive = pointer.active;
  lastInputWasTouch = Boolean(event.touches || event.pointerType === "touch");
  pointer.targetX = point.clientX;
  pointer.targetY = point.clientY;
  if (!wasActive) {
    pointer.x = pointer.targetX;
    pointer.y = pointer.targetY;
  }
  pointer.active = true;
  pointer.lastMove = performance.now();

  const shouldRemember = lastInputWasTouch ? pointer.down : true;
  if (shouldRemember && performance.now() - lastMemory > 30) {
    addColorMemory(pointer.targetX, pointer.targetY, 0.86);
    lastMemory = performance.now();
  }
}

window.addEventListener("resize", resize);
window.addEventListener("pointermove", updatePointer);
window.addEventListener("pointerdown", (event) => {
  pointer.down = true;
  updatePointer(event);
  pointer.x = pointer.targetX;
  pointer.y = pointer.targetY;
  addColorMemory(pointer.targetX, pointer.targetY, 0.96);
});
window.addEventListener("pointerup", () => {
  pointer.down = false;
});
window.addEventListener("pointercancel", () => {
  pointer.down = false;
});
window.addEventListener("touchmove", updatePointer, { passive: true });
window.addEventListener("touchend", () => {
  pointer.down = false;
});
window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
  reducedMotion = event.matches;
});

resize();
requestAnimationFrame(draw);
