(function () {
  const wrap = document.getElementById("horse-game-wrap");
  const canvas = document.getElementById("horse-game");
  const clip = document.getElementById("horse-clip");
  const crop = clip && clip.querySelector(".horse-crop");
  const sprite = document.getElementById("horse-sprite");
  const hint = document.getElementById("horse-game-hint");
  if (!wrap || !canvas || !clip || !crop || !sprite) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (hint) hint.textContent = "Canvas isn't supported in this browser.";
    return;
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) {}
  }

  const VIEW_H = 180;
  const GROUND = 148;
  const HORSE_X = 22;
  const CROP = { x: 131, y: 98, w: 228, h: 150, iw: 500, ih: 375 };
  const HORSE_W = 68;
  const HORSE_H = CROP.h * (HORSE_W / CROP.w);
  const GRAVITY = 0.72;
  const JUMP_V = -8.9;
  const HI_KEY = "horseJumpHi";
  const COLOR = "#f3ede0";
  const DOT_R = 1.15;
  const DOT_GAP = 3.1;
  const RAIL_R = 1.45;
  const RAIL_GAP = 3.4;
  const OXER_SPREAD = 11;

  let worldW = 700;
  let playing = false;
  let dead = false;
  let speed = 5.2;
  let score = 0;
  let hi = Number(storageGet(HI_KEY) || 0);
  let spawnIn = 45;
  let groundShift = 0;
  let obstacles = [];
  let frozenFrame = null;
  const horse = { y: 0, vy: 0, onGround: true };

  function groundY() {
    return GROUND - HORSE_H;
  }

  function resize() {
    const cssW = Math.max(wrap.clientWidth || wrap.parentElement.clientWidth || 640, 280);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(VIEW_H * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = VIEW_H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    worldW = cssW;
  }

  function setHint(text) {
    if (hint) hint.textContent = text;
  }

  function placeSprite() {
    const scale = HORSE_W / CROP.w;
    clip.style.width = HORSE_W + "px";
    clip.style.height = HORSE_H + "px";
    clip.style.left = HORSE_X + "px";
    clip.style.top = horse.y + "px";
    sprite.style.width = CROP.iw * scale + "px";
    sprite.style.left = -CROP.x * scale + "px";
    sprite.style.top = -CROP.y * scale + "px";
  }

  function showRunningHorse() {
    if (frozenFrame && frozenFrame.parentNode) {
      frozenFrame.parentNode.removeChild(frozenFrame);
    }
    frozenFrame = null;
    sprite.style.visibility = "";
  }

  function knockoutWhite(canvas) {
    const fctx = canvas.getContext("2d");
    const image = fctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] + d[i + 1] + d[i + 2] > 560) d[i + 3] = 0;
    }
    fctx.putImageData(image, 0, 0);
  }

  function freezeHorse() {
    if (frozenFrame) return;
    frozenFrame = document.createElement("canvas");
    frozenFrame.width = Math.max(1, Math.ceil(HORSE_W));
    frozenFrame.height = Math.max(1, Math.ceil(HORSE_H));
    const fctx = frozenFrame.getContext("2d");
    fctx.drawImage(sprite, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, HORSE_W, HORSE_H);
    try { knockoutWhite(frozenFrame); } catch (e) {}
    frozenFrame.style.left = "0";
    frozenFrame.style.top = "0";
    frozenFrame.style.width = "100%";
    frozenFrame.style.height = "100%";
    sprite.style.visibility = "hidden";
    crop.appendChild(frozenFrame);
  }

  function reset() {
    playing = false;
    dead = false;
    speed = 5.2;
    score = 0;
    spawnIn = 45;
    groundShift = 0;
    obstacles = [];
    horse.y = groundY();
    horse.vy = 0;
    horse.onGround = true;
    setHint("Press space or tap to jump");
    showRunningHorse();
    placeSprite();
  }

  function jump() {
    if (dead) reset();
    if (!playing) {
      playing = true;
      setHint("\u00a0");
    }
    if (horse.onGround) {
      horse.vy = JUMP_V;
      horse.onGround = false;
      placeSprite();
    }
  }

  function spawn() {
    const x = worldW + 10;
    if (Math.random() < 0.58) {
      obstacles.push({
        type: "vertical",
        x: x,
        h: 22 + Math.floor(Math.random() * 12)
      });
      return;
    }
    let front = 20 + Math.floor(Math.random() * 8);
    let back = 26 + Math.floor(Math.random() * 10);
    if (front > back) {
      const tmp = front;
      front = back;
      back = tmp;
    }
    obstacles.push({
      type: "oxer",
      x: x,
      hFront: front,
      hBack: back
    });
  }

  function railHit(x, h) {
    const hx = HORSE_X + 10;
    const hy = horse.y + HORSE_H * 0.28;
    const hw = HORSE_W - 20;
    const hh = HORSE_H * 0.62;
    const rw = 4;
    const ox = x - rw / 2;
    const oy = GROUND - h;
    return hx < ox + rw && hx + hw > ox && hy < oy + h && hy + hh > oy;
  }

  function collides(o) {
    if (o.type === "oxer") {
      return railHit(o.x, o.hFront) || railHit(o.x + OXER_SPREAD, o.hBack);
    }
    return railHit(o.x, o.h);
  }

  function dot(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRail(x, h) {
    const top = GROUND - h;
    for (let y = GROUND - RAIL_R; y >= top; y -= RAIL_GAP) {
      dot(x, y, RAIL_R);
    }
  }

  function drawHurdle(o) {
    ctx.fillStyle = COLOR;
    if (o.type === "oxer") {
      drawRail(o.x, o.hFront);
      drawRail(o.x + OXER_SPREAD, o.hBack);
      return;
    }
    drawRail(o.x, o.h);
  }

  function obstacleWidth(o) {
    return o.type === "oxer" ? OXER_SPREAD + 4 : 4;
  }

  function pad(n) {
    return String(Math.floor(n)).padStart(5, "0");
  }

  function tick() {
    ctx.clearRect(0, 0, worldW, VIEW_H);

    ctx.fillStyle = COLOR;
    if (playing && !dead) groundShift = (groundShift + speed) % DOT_GAP;
    for (let x = -groundShift; x < worldW + 4; x += DOT_GAP) {
      dot(x, GROUND, DOT_R);
    }

    if (playing && !dead) {
      horse.vy += GRAVITY;
      horse.y += horse.vy;
      if (horse.y >= groundY()) {
        horse.y = groundY();
        horse.vy = 0;
        horse.onGround = true;
      }

      spawnIn -= 1;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = 50 + Math.floor(Math.random() * 45);
      }

      for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].x -= speed;
        if (collides(obstacles[i])) {
          dead = true;
          freezeHorse();
          hi = Math.max(hi, Math.floor(score));
          storageSet(HI_KEY, String(hi));
          setHint("Game over — press space or tap to retry");
        }
      }
      obstacles = obstacles.filter(function (o) { return o.x + obstacleWidth(o) > -20; });
      score += 0.2;
      speed = Math.min(10.5, 5.2 + score / 140);
    }

    for (let i = 0; i < obstacles.length; i++) drawHurdle(obstacles[i]);
    placeSprite();

    ctx.fillStyle = COLOR;
    ctx.imageSmoothingEnabled = false;
    ctx.font = '10px "Press Start 2P", ui-monospace, monospace';
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(pad(score), worldW - 8, 10);
    if (hi) {
      ctx.globalAlpha = 0.5;
      const scoreW = ctx.measureText(pad(score)).width;
      ctx.fillText("HI " + pad(hi), worldW - 8 - scoreW - 16, 10);
      ctx.globalAlpha = 1;
    }

    requestAnimationFrame(tick);
  }

  function onJumpEvent(e) {
    if (e.type === "keydown" && e.code !== "Space" && e.code !== "ArrowUp") return;
    if (e.type === "keydown") e.preventDefault();
    jump();
  }

  wrap.addEventListener("pointerdown", onJumpEvent);
  window.addEventListener("keydown", onJumpEvent);
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);

  if (document.fonts && document.fonts.load) {
    document.fonts.load('10px "Press Start 2P"');
  }

  try {
    resize();
    reset();
    tick();
  } catch (err) {
    setHint("Game failed to start: " + err.message);
  }
})();
