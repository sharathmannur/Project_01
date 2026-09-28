import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

// --- WEB AUDIO API ENGINE ---
// BUG 1 FIX: create AudioContext lazily on first use, not at module load
// (Chrome/Safari block AudioContext until a user gesture)
let actx = null;
const getAudioContext = () => {
  if (!actx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    actx = new AudioContext();
  }
  return actx;
};

const playSound = (type) => {
  const actx = getAudioContext();
  if (actx.state === 'suspended') actx.resume();
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.connect(gain);
  gain.connect(actx.destination);
  const now = actx.currentTime;
  
  if (type === 'shoot') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'hit') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(800, now + 0.05);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);
    osc.start(now); osc.stop(now + 0.15);
  } else if (type === 'miss') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.3);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    osc.start(now); osc.stop(now + 0.3);
  } else if (type === 'round_start') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.setValueAtTime(400, now + 0.1);
    osc.frequency.setValueAtTime(500, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.4);
    osc.start(now); osc.stop(now + 0.4);
  } else if (type === 'laugh') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.2);
    osc.frequency.setValueAtTime(280, now + 0.25);
    osc.frequency.linearRampToValueAtTime(130, now + 0.45);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.6);
    osc.start(now); osc.stop(now + 0.6);
  }
};

// --- SPRITES ---
const CELL = 4; // Increased cell size for better detail
const ACROBAT_SWING = [
  ".......RRRR.......",
  "......RRRRRR......",
  ".....RRWWWWRR.....",
  ".....RRRRRRRRR....",
  "......RRBBRBB.....",
  ".....RRRBBBBRRR...",
  "....RR.BBBBBB.RR..",
  "....RR..BBBBB..RR.",
  ".....RR..BBB..RR..",
  "......RR.RRR.RR...",
  ".......RRRRRR.....",
  "......RRR...RRR..."
];
const VIGILANTE_STAND = [
  ".......FFFFFF.......",
  "......FFFFFFFF......",
  "......FFKKKKFF......",
  "......FFFFFFFF......",
  "....KKKKKKKKKKKK....",
  "...KKKWWKKKKWWKKK...",
  "...KKKKWWWWWWKKKK...",
  "....KKKKKWWKKKKK....",
  ".....KKKK..KKKK.....",
  ".....KKK....KKK.....",
  "....KKK......KKK...."
];
const DRONE_SPRITE = [
  "...K..........K...",
  "..K.KKKKKKKKKK.K..",
  ".K..KRRRRRRRK..K..",
  "KKKKKRWWWWWWKKKKK.",
  "....KKKKKKKKK....."
];

const PALETTES = {
  acrobat: { 
    R: '#ff3366', // Bright red/pink
    B: '#0066ff', // Electric blue
    W: '#00ddff' // Cyan
  },
  vigilante: { 
    F: '#ff4466', // Red
    K: '#0055ff', // Blue
    W: '#00ffff' // Bright cyan
  },
  drone: { 
    K: '#ff0066', // Hot pink
    R: '#0088ff', // Sky blue
    W: '#00ffee' // Cyan-white
  }
};

// BUG 11 FIX: flip around sprite center — translate to (x,y), scale(-1,1) to flip
// around that center, then offset to top-left for drawing individual cells.
const drawGrid = (ctx, x, y, grid, palette, flip=false, scale=1) => {
  const H = grid.length, W = grid[0].length;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.translate(-(W*CELL*scale)/2, -(H*CELL*scale)/2);
  for (let r=0; r<H; r++) {
    for (let c=0; c<W; c++) {
      const ch = grid[r][c];
      if (ch !== '.') {
        ctx.fillStyle = palette[ch];
        ctx.fillRect(c*CELL*scale, r*CELL*scale, CELL*scale, CELL*scale);
      }
    }
  }
  ctx.restore();
};

const MISS_TAUNTS = [
  "CANT YOU DO IT MAN?",
  "A 3 YEAR OLD COULD HAVE PLAYED BETTER!",
  "STORMTROOPER AIM!",
  "WAS THAT A WARNING SHOT?",
  "IS YOUR MOUSE BROKEN?",
  "OPEN YOUR EYES, MAN!",
  "EVEN I COULD HIT THAT!",
  "MY GRANDMA AIMS BETTER!",
  "ARE YOU PLAYING WITH YOUR FEET?",
  "WAKE UP, HERO!",
  "I'VE SEEN BETTER AIM FROM A POTATO.",
  "YOU'RE SHOOTING BLANKS!",
  "PACIFIST RUN?",
  "YOU CALL THAT AN ATTACK?"
];

const GAME_OVER_TAUNTS = [
  "OH COOL YOU HAVE FINALLY ENDED YOUR BROS LOVE STORY.",
  "WITH GREAT POWER COMES TERRIBLE AIM.",
  "THE REAL PUNISHMENT IS YOUR SCORE.",
  "SPIDEY: 1, YOU: 0.",
  "DONT QUIT YOUR DAY JOB.",
  "THE CITY IS DOOMED THANKS TO YOU.",
  "BACK TO TRAINING WHEELS FOR YOU.",
  "MAYBE TRY MINESWEEPER INSTEAD?",
  "EVEN J. JONAH JAMESON IS DISAPPOINTED.",
  "YOU LET THEM GET AWAY! THE RENT IS STILL DUE!"
];

// --- GAME LOGIC ENGINE ---
class GameEngine {
  constructor(canvas, updateReactState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.updateReactState = updateReactState;
    
    // Internal logical resolution (16:9)
    this.W = 800; this.H = 450;
    this.canvas.width = this.W; this.canvas.height = this.H;
    
    this.state = 'MENU'; 
    this.mode = 1; // 1=EASY, 2=MEDIUM, 3=HARD
    
    this.score = 0;
    this.hiScore = parseInt(localStorage.getItem('retroweb_hi')) || 0;
    this.round = 1;
    this.ammo = 5;
    this.maxAmmo = 5;
    
    this.targets = [];
    this.particles = [];
    this.floatingTexts = []; 
    this.history = new Array(10).fill('empty');
    this.targetsSpawned = 0;
    this.shotsFired = 0;
    this.currentCombo = 0; 
    this.gameOverTaunt = "";
    
    this.mascot = { active: false, y: this.H, type: 'laugh', timer: 0 };
    
    this.lastTime = performance.now();
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  startGame(mode) {
    this.mode = mode;
    this.score = 0;
    this.round = 1;
    this.currentCombo = 0;
    this.gameOverTaunt = "";
    
    // Determine Max Ammo based on Difficulty Level
    if (this.mode === 1) this.maxAmmo = 5; // Easy
    else if (this.mode === 2) this.maxAmmo = 4; // Medium
    else this.maxAmmo = 3; // Hard
    
    this.startRound();
  }

  startRound() {
    this.history = new Array(10).fill('empty');
    this.targetsSpawned = 0;
    this.targets = [];
    this.particles = [];
    this.floatingTexts = [];
    this.state = 'ROUND_START';
    this.syncState();
    playSound('round_start');
    
    setTimeout(() => {
      if (this.state === 'ROUND_START') {
        this.state = 'PLAYING';
        this.spawnWave();
      }
    }, 1500);
  }

  spawnWave() {
    this.ammo = this.maxAmmo;
    this.targets = [];
    
    // Targets per wave based on Difficulty Level
    let count = 1;
    if (this.mode === 2) count = 2; // Medium: 2 acrobats
    if (this.mode === 3) count = 2; // Hard: acrobat + drone mix
    
    for (let i=0; i<count; i++) {
      if (this.mode === 3 && i === 1) {
        this.targets.push(this.createDrone());
      } else {
        this.targets.push(this.createAcrobat());
      }
    }
    this.targetsSpawned += count;
    this.syncState();
  }

  // --- ENTITY CREATION ---
  createAcrobat() {
    // Huge difficulty tweaks here based on level
    let speedMult = 0.5 + (this.round * 0.05); // EASY base speed
    if (this.mode === 2) speedMult = 0.8 + (this.round * 0.05); // MEDIUM
    if (this.mode === 3) speedMult = 1.2 + (this.round * 0.1); // HARD
    
    const dir = Math.random() > 0.5 ? 1 : -1;
    const startY = 150 + Math.random() * 100; 
    
    return {
      type: 'acrobat',
      x: dir === 1 ? -80 : this.W + 80,
      y: startY,
      baseY: startY,
      vx: (140 + Math.random() * 40) * speedMult * dir, 
      amplitude: 140 + Math.random() * 50, // Massive swing down to bottom third of screen
      phase: Math.random() * Math.PI,
      phaseSpeed: (2.0 + Math.random()) * speedMult,
      dead: false,
      escaped: false,
      escapeTimer: 0,
      speedGlitched: false,
      freezeTimer: 0,
      freezeCount: 0,
      // More forgiving screen time on easy
      maxTime: this.mode === 1 ? 5.0 : Math.max(1.5, 4.0 - (this.round * 0.2)) 
    };
  }

  createDrone() {
    let speedMult = 1.0 + (this.round * 0.1);
    const dir = Math.random() > 0.5 ? 1 : -1;
    return {
      type: 'drone',
      x: dir === 1 ? -40 : this.W + 40,
      y: this.H * 0.5 + (Math.random() * 120 - 60), 
      vx: (160 + Math.random() * 60) * speedMult * dir,
      vy: (-20 - Math.random() * 30) * speedMult,
      scale: 2.5,
      dead: false,
      escaped: false,
      escapeTimer: 0,
      speedGlitched: false,
      freezeTimer: 0,
      freezeCount: 0,
      maxTime: Math.max(1.5, 3.5 - (this.round * 0.15))
    };
  }

  // --- INPUT ---
  shoot(x, y) {
    if (this.state !== 'PLAYING') return;
    if (this.ammo <= 0) return;
    
    this.ammo--;
    this.shotsFired++;
    playSound('shoot');
    
    // Enhanced muzzle flash with pulse effect
    const flashEl = document.getElementById('screen-flash');
    if (flashEl) {
      flashEl.style.opacity = '0.5';
      flashEl.style.background = 'radial-gradient(circle at ' + ((x/this.W)*100) + '% ' + ((y/this.H)*100) + '%, rgba(255,200,50,0.6) 0%, rgba(255,255,255,0.3) 20%, transparent 40%)';
      setTimeout(() => flashEl.style.opacity = '0', 80);
    }

    let hitAnything = false;

    // Difficulty based hit boxes
    let radiusMult = 1.0;
    if (this.mode === 1) radiusMult = 1.5; // Huge hit boxes for Easy
    if (this.mode === 3) radiusMult = 0.8; // Small hit boxes for Hard

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (t.dead || t.escaped) continue;
      
      // BUG 4 FIX: use actual position, not stale phantom offset
      // BUG 12 FIX: drone uses fixed radius 24, not 24*scale (scale shrinks over time)
      const baseRadius = t.type === 'drone' ? 24 : 32;
      const radius = baseRadius * radiusMult;
      const dist = Math.hypot(t.x - x, t.y - y);
      
      if (dist < radius) {
        t.dead = true;
        hitAnything = true;
        this.currentCombo++;
        playSound('hit');
        
        const basePts = (t.type === 'drone' ? 1000 : 500) + (this.round * 100);
        const comboMult = this.currentCombo > 1 ? this.currentCombo : 1;
        const totalPts = basePts * comboMult;
        
        this.score += totalPts;
        if (this.score > this.hiScore) {
          this.hiScore = this.score;
          localStorage.setItem('retroweb_hi', this.hiScore);
        }
        
        this.floatingTexts.push({ x: t.x, y: t.y - 30, text: `+${totalPts}`, color: '#f1c40f', life: 1.2, isTaunt: false });
        if (this.currentCombo > 1) {
            this.floatingTexts.push({ x: t.x, y: t.y - 50, text: `${this.currentCombo}X COMBO!`, color: '#e23636', life: 1.5, isTaunt: false });
        }

        this.spawnExplosion(t.x, t.y, t.type === 'drone' ? '#ff3333' : '#e23636');
        
        const idx = this.targetsSpawned - this.targets.length + i;
        if (idx < 10) this.history[idx] = 'hit';
        break; 
      }
    }

    if (!hitAnything) {
        playSound('miss');
        this.currentCombo = 0; 
        
        // Clear previous taunts to prevent unreadable overlaps
        this.floatingTexts = this.floatingTexts.filter(ft => !ft.isTaunt);
        const taunt = MISS_TAUNTS[Math.floor(Math.random() * MISS_TAUNTS.length)];
        
        // Spawn taunt in the upper center of the screen
        this.floatingTexts.push({
          x: this.W / 2, y: this.H / 3, text: taunt, color: '#ff6b6b', life: 2.5, isTaunt: true
        });
    }
    
    this.checkWaveEnd();
    this.syncState();
  }

  checkWaveEnd() {
    const allDead = this.targets.every(t => t.dead);
    const allEscaped = this.targets.every(t => t.escaped || t.dead);
    
    // BUG 7 FIX: allDead was computed but never used — now it triggers wave end
    // immediately when every target is killed (no need to wait for escape timer)
    if (allDead || (this.ammo === 0 && allEscaped) || allEscaped) {
      setTimeout(() => this.endWave(), 600);
    }
  }

  endWave() {
    if (this.state !== 'PLAYING') return;
    
    let caughtCount = this.targets.filter(t => t.dead).length;
    
    if (this.targets.length > 0 && this.targets.some(t => t.escaped && !t.dead)) {
       this.currentCombo = 0; 
       this.targets.forEach((t, i) => {
         if (t.escaped && !t.dead) {
           const idx = this.targetsSpawned - this.targets.length + i;
           if (idx < 10) this.history[idx] = 'miss';
         }
       });
    }

    this.state = 'END_ANIM';
    this.mascot.active = true;
    this.mascot.y = this.H;
    this.mascot.timer = 0;
    
    if (caughtCount > 0) {
      this.mascot.type = 'stand';
    } else {
      this.mascot.type = 'laugh';
      playSound('laugh');
    }
    this.syncState();
  }

  spawnExplosion(x, y, color) {
    // Premium explosion with blue/red particle theme
    const particleCount = 60;
    
    // Core explosion burst
    for(let i=0; i<particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 180 + Math.random() * 300;
      const lifetime = 0.7 + Math.random() * 0.6;
      
      // Alternate between blue and red particles
      let particleColor;
      if (i % 3 === 0) {
        particleColor = '#0099ff'; // Blue
      } else if (i % 3 === 1) {
        particleColor = '#ff3366'; // Red
      } else {
        particleColor = '#00ddff'; // Cyan
      }
      
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 80,
        vy: Math.sin(angle) * speed + (Math.random() - 0.5) * 80,
        life: lifetime,
        color: particleColor,
        size: 2 + Math.random() * 5
      });
    }
    
    // Add sparkles (magenta/cyan mix)
    for(let i=0; i<20; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 150,
        vy: (Math.random() - 0.5) * 150 - 100,
        life: 1.2 + Math.random() * 0.4,
        color: Math.random() > 0.5 ? 'rgba(255, 0, 200, 0.95)' : 'rgba(0, 255, 255, 0.95)',
        size: 1 + Math.random() * 2
      });
    }
  }

  // --- LOOP & RENDERING ---
  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    
    this.update(dt);
    this.draw();
    
    this.reqId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    if (this.state === 'PLAYING') {
      let activeCount = 0;
      
      this.targets.forEach(t => {
        if (t.dead) {
          t.y += 500 * dt; 
          return;
        }
        if (t.escaped) return;
        
        t.escapeTimer += dt;
        if (t.escapeTimer > t.maxTime || t.x < -150 || t.x > this.W + 150 || t.y < -150) {
          t.escaped = true;
          this.checkWaveEnd();
        }

        // BUG 5 FIX: removed sudden 2.2× speed multiplier after 1 second on-screen

        // BUG 6 FIX: removed arbitrary 0.9s freeze logic


        if (t.type === 'acrobat') {
          t.x += t.vx * dt;
          t.phase += t.phaseSpeed * dt;
          t.y = t.baseY + Math.sin(t.phase) * t.amplitude;
        } else if (t.type === 'drone') {
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          t.scale = Math.max(0.5, t.scale - 0.5 * dt); 
        }
        activeCount++;
      });
      
      if (this.ammo === 0 && activeCount > 0) {
        this.targets.forEach(t => { if(!t.dead) t.escapeTimer += dt * 5; });
      }
    }

    if (this.state === 'END_ANIM') {
      this.mascot.timer += dt;
      if (this.mascot.timer < 0.5) this.mascot.y -= 150 * dt; 
      else if (this.mascot.timer > 2.0) this.mascot.y += 150 * dt; 
      
      if (this.mascot.timer > 2.5) {
        this.mascot.active = false;
        if (this.targetsSpawned >= 10) this.checkRoundClear();
        else { this.state = 'PLAYING'; this.spawnWave(); }
      }
    }

    this.particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 1.5;
    });
    this.particles = this.particles.filter(p => p.life > 0);

    this.floatingTexts.forEach(ft => {
      ft.y -= (ft.isTaunt ? 5 : 45) * dt;
      ft.life -= dt;
    });
    this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
  }

  checkRoundClear() {
    const hits = this.history.filter(h => h === 'hit').length;
    // Progression requirements scaled by difficulty
    let required = 5 + Math.floor(this.round / 2);
    if (this.mode === 1) required -= 1; // Easier to pass on easy mode
    required = Math.min(required, 10);
    
    if (hits >= required) {
      this.round++;
      this.startRound();
    } else {
      this.state = 'GAME_OVER';
      this.gameOverTaunt = GAME_OVER_TAUNTS[Math.floor(Math.random() * GAME_OVER_TAUNTS.length)];
      this.syncState();
    }
  }

  draw() {
    const ctx = this.ctx;
    const time = performance.now() / 3000;
    
    // Deep space background - black with subtle dark blue gradient
    const spaceGradient = ctx.createRadialGradient(
      this.W / 2, this.H / 2, 0,
      this.W / 2, this.H / 2, this.H
    );
    spaceGradient.addColorStop(0, '#0a0a1a');
    spaceGradient.addColorStop(0.5, '#050510');
    spaceGradient.addColorStop(1, '#000000');
    ctx.fillStyle = spaceGradient;
    ctx.fillRect(0, 0, this.W, this.H);
    
    // Distant galaxy/nebula - blue
    ctx.globalAlpha = 0.15;
    const blueNebula = ctx.createRadialGradient(
      this.W * 0.25 + Math.sin(time * 0.3) * 80, 
      this.H * 0.3 + Math.cos(time * 0.2) * 60, 
      50,
      this.W * 0.25, 
      this.H * 0.3, 
      350
    );
    blueNebula.addColorStop(0, 'rgba(0, 100, 255, 0.6)');
    blueNebula.addColorStop(0.5, 'rgba(0, 150, 255, 0.3)');
    blueNebula.addColorStop(1, 'transparent');
    ctx.fillStyle = blueNebula;
    ctx.fillRect(0, 0, this.W, this.H);
    
    // Red nebula on the other side
    const redNebula = ctx.createRadialGradient(
      this.W * 0.75 + Math.cos(time * 0.4) * 100, 
      this.H * 0.6 + Math.sin(time * 0.35) * 70, 
      60,
      this.W * 0.75, 
      this.H * 0.6, 
      320
    );
    redNebula.addColorStop(0, 'rgba(255, 50, 100, 0.5)');
    redNebula.addColorStop(0.5, 'rgba(255, 80, 120, 0.25)');
    redNebula.addColorStop(1, 'transparent');
    ctx.fillStyle = redNebula;
    ctx.fillRect(0, 0, this.W, this.H);
    
    // Purple/magenta nebula center
    const purpleNebula = ctx.createRadialGradient(
      this.W * 0.5, 
      this.H * 0.5, 
      30,
      this.W * 0.5, 
      this.H * 0.5, 
      250
    );
    purpleNebula.addColorStop(0, 'rgba(200, 50, 255, 0.3)');
    purpleNebula.addColorStop(1, 'transparent');
    ctx.fillStyle = purpleNebula;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.globalAlpha = 1.0;
    
    // Distant planet - blue
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#0088ff';
    ctx.fillStyle = '#0066cc';
    ctx.beginPath();
    ctx.arc(this.W - 120, 100, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Planet rings
    ctx.strokeStyle = 'rgba(0, 150, 255, 0.4)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(this.W - 120, 100, 70, 20, Math.PI / 6, 0, Math.PI * 2);
    ctx.stroke();
    
    // Small red moon
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0066';
    ctx.fillStyle = '#ff3366';
    ctx.beginPath();
    ctx.arc(this.W - 180, 140, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Large Earth rising on the horizon (iconic moon view)
    ctx.save();
    ctx.globalAlpha = 0.9;
    const earthX = 150;
    const earthY = this.H - 150;
    const earthRadius = 120;
    
    // Earth glow
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'rgba(0, 150, 255, 0.8)';
    
    // Earth body - blue with clouds
    const earthGradient = ctx.createRadialGradient(
      earthX - 30, earthY - 30, 0,
      earthX, earthY, earthRadius
    );
    earthGradient.addColorStop(0, '#00aaff');
    earthGradient.addColorStop(0.6, '#0066cc');
    earthGradient.addColorStop(1, '#003366');
    ctx.fillStyle = earthGradient;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Earth continents (dark blue/green)
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 100, 80, 0.6)';
    ctx.beginPath();
    ctx.arc(earthX - 40, earthY - 20, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(earthX + 30, earthY + 10, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(earthX + 10, earthY - 50, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Earth clouds (white wispy)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(earthX - 20, earthY + 30, 35, 15, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(earthX + 40, earthY - 30, 30, 12, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Atmospheric glow
    ctx.globalAlpha = 0.3;
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#00ddff';
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius + 8, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
    ctx.shadowBlur = 0;
    
    // Starfield - multiple layers for depth
    // Distant stars (small, dim)
    ctx.fillStyle = '#ffffff';
    for(let i=0; i<80; i++) {
      const sx = (Math.sin(i*743)*0.5+0.5) * this.W;
      const sy = (Math.cos(i*312)*0.5+0.5) * this.H;
      const twinkle = Math.sin(time * 2 + i) * 0.3 + 0.7;
      ctx.globalAlpha = 0.3 * twinkle;
      ctx.fillRect(sx, sy, 1, 1);
    }
    
    // Medium stars (blue tint)
    for(let i=0; i<50; i++) {
      const sx = (Math.sin(i*456 + 100)*0.5+0.5) * this.W;
      const sy = (Math.cos(i*789 + 100)*0.5+0.5) * this.H;
      const twinkle = Math.sin(time * 3 + i) * 0.4 + 0.6;
      ctx.fillStyle = i % 3 === 0 ? '#00ddff' : '#ffffff';
      ctx.globalAlpha = 0.6 * twinkle;
      ctx.fillRect(sx, sy, 2, 2);
    }
    
    // Close stars (bright, some red/blue)
    for(let i=0; i<30; i++) {
      const sx = (Math.sin(i*234 + 200)*0.5+0.5) * this.W;
      const sy = (Math.cos(i*567 + 200)*0.5+0.5) * this.H;
      const twinkle = Math.sin(time * 4 + i) * 0.5 + 0.5;
      const size = 2 + Math.sin(i * 10) * 1;
      
      // Color variation
      if (i % 4 === 0) {
        ctx.fillStyle = '#ff3366'; // Red stars
      } else if (i % 4 === 1) {
        ctx.fillStyle = '#00aaff'; // Blue stars
      } else {
        ctx.fillStyle = '#ffffff'; // White stars
      }
      
      ctx.globalAlpha = 0.7 + twinkle * 0.3;
      ctx.shadowBlur = 3;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillRect(sx, sy, size, size);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;

    // Targets with enhanced visuals and floating particles
    this.targets.forEach(t => {
      if (t.escaped && !t.dead) return;
      
      if (t.type === 'acrobat') {
        // Enhanced rope with blue/cyan gradient and glow
        const ropeGradient = ctx.createLinearGradient(t.x, -200, t.x, t.y);
        ropeGradient.addColorStop(0, 'rgba(0, 150, 255, 0.2)');
        ropeGradient.addColorStop(0.5, 'rgba(0, 200, 255, 0.6)');
        ropeGradient.addColorStop(1, 'rgba(0, 255, 255, 0.9)');
        ctx.strokeStyle = ropeGradient;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(0, 200, 255, 0.9)';
        ctx.beginPath();
        ctx.moveTo(t.x + (t.vx * 0.3), -200);
        
        // Add rope wave effect
        const segments = 10;
        for(let i = 0; i <= segments; i++) {
          const progress = i / segments;
          const ropeY = -200 + (t.y + 200) * progress;
          const wave = Math.sin(performance.now() / 200 + i) * 8;
          ctx.lineTo(t.x + wave, ropeY);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        if (!t.dead) {
          // Add blue/cyan floating particles around character
          if (Math.random() > 0.7) {
            this.particles.push({
              x: t.x + (Math.random() - 0.5) * 40,
              y: t.y + (Math.random() - 0.5) * 40,
              vx: (Math.random() - 0.5) * 50,
              vy: -20 - Math.random() * 30,
              life: 0.8 + Math.random() * 0.4,
              color: Math.random() > 0.5 ? 'rgba(0, 200, 255, 0.9)' : 'rgba(255, 50, 100, 0.8)',
              size: 2 + Math.random() * 2
            });
          }
          
          // Enhanced glow with blue/red
          ctx.shadowBlur = 28;
          ctx.shadowColor = 'rgba(0, 150, 255, 0.95)';
          
          // Outer glow
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.shadowBlur = 35;
          const rotation = Math.sin(t.phase) * 0.18;
          ctx.translate(t.x, t.y);
          ctx.rotate(rotation);
          drawGrid(ctx, 0, 0, ACROBAT_SWING, PALETTES.acrobat, t.vx > 0, 2.2);
          ctx.restore();
          
          // Main character
          ctx.globalAlpha = 1.0;
          ctx.shadowBlur = 20;
          ctx.save();
          ctx.translate(t.x, t.y);
          ctx.rotate(rotation);
          drawGrid(ctx, 0, 0, ACROBAT_SWING, PALETTES.acrobat, t.vx > 0, 2.0);
          ctx.restore();
          ctx.shadowBlur = 0;
        }
      } else if (t.type === 'drone') {
        if (!t.dead) {
          // Add red/pink particle trail for drone
          if (Math.random() > 0.6) {
            this.particles.push({
              x: t.x + (Math.random() - 0.5) * 30,
              y: t.y + (Math.random() - 0.5) * 30,
              vx: -t.vx * 0.3 + (Math.random() - 0.5) * 20,
              vy: -t.vy * 0.3 + (Math.random() - 0.5) * 20,
              life: 0.6 + Math.random() * 0.3,
              color: Math.random() > 0.5 ? 'rgba(255, 50, 100, 0.8)' : 'rgba(255, 0, 100, 0.7)',
              size: 2 + Math.random() * 3
            });
          }
          
          // Pulsing red/pink glow effect
          const pulsate = Math.sin(performance.now() / 180) * 0.12 + 0.92;
          const time = performance.now() / 1000;
          
          // Outer red glow layer
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.shadowBlur = 35;
          ctx.shadowColor = 'rgba(255, 30, 100, 0.95)';
          ctx.translate(t.x, t.y);
          ctx.scale(pulsate * 1.1, pulsate * 1.1);
          drawGrid(ctx, 0, 0, DRONE_SPRITE, PALETTES.drone, false, t.scale);
          ctx.restore();
          
          // Middle blue glow
          ctx.shadowBlur = 28;
          ctx.shadowColor = 'rgba(0, 150, 255, 0.85)';
          ctx.globalAlpha = 1.0;
          ctx.save();
          ctx.translate(t.x, t.y);
          ctx.rotate(Math.sin(time * 2) * 0.1); // Slight rotation
          ctx.scale(pulsate, pulsate);
          drawGrid(ctx, 0, 0, DRONE_SPRITE, PALETTES.drone, false, t.scale);
          ctx.restore();
          ctx.shadowBlur = 0;
        }
      }
    });

    // Premium particles with layered glow and motion blur effect
    this.particles.forEach(p => {
      const size = p.size || 5;
      const alpha = Math.max(0, p.life);
      
      // Outer glow
      ctx.save();
      ctx.globalAlpha = alpha * 0.3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // Middle glow
      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // Core bright center
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;

    // Moon surface foreground with craters and lunar landscape
    // Dark lunar ground with gradient
    const lunarGradient = ctx.createLinearGradient(0, this.H - 100, 0, this.H);
    lunarGradient.addColorStop(0, 'rgba(40, 40, 50, 0.95)');
    lunarGradient.addColorStop(0.5, 'rgba(30, 30, 40, 1)');
    lunarGradient.addColorStop(1, 'rgba(20, 20, 30, 1)');
    ctx.fillStyle = lunarGradient;
    ctx.fillRect(0, this.H - 100, this.W, 100);
    
    // Moon craters (circular depressions)
    const craters = [
      {x: 80, y: this.H - 40, r: 35},
      {x: 200, y: this.H - 55, r: 45},
      {x: 350, y: this.H - 35, r: 30},
      {x: 500, y: this.H - 60, r: 50},
      {x: 650, y: this.H - 30, r: 25},
      {x: 750, y: this.H - 45, r: 38}
    ];
    
    craters.forEach(crater => {
      // Crater shadow
      const craterGradient = ctx.createRadialGradient(
        crater.x, crater.y, 0,
        crater.x, crater.y, crater.r
      );
      craterGradient.addColorStop(0, 'rgba(15, 15, 25, 0.9)');
      craterGradient.addColorStop(0.7, 'rgba(25, 25, 35, 0.6)');
      craterGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = craterGradient;
      ctx.beginPath();
      ctx.arc(crater.x, crater.y, crater.r, 0, Math.PI * 2);
      ctx.fill();
      
      // Crater rim highlight (blue tint from space)
      ctx.strokeStyle = 'rgba(100, 150, 200, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(crater.x - crater.r * 0.3, crater.y - crater.r * 0.3, crater.r * 0.9, 0, Math.PI);
      ctx.stroke();
    });
    
    // Moon rocks scattered on surface
    const rocks = [
      {x: 120, y: this.H - 15, w: 20, h: 12},
      {x: 280, y: this.H - 10, w: 15, h: 8},
      {x: 420, y: this.H - 18, w: 25, h: 15},
      {x: 580, y: this.H - 12, w: 18, h: 10},
      {x: 700, y: this.H - 16, w: 22, h: 13}
    ];
    
    rocks.forEach(rock => {
      // Rock shadow
      ctx.fillStyle = 'rgba(10, 10, 20, 0.7)';
      ctx.beginPath();
      ctx.ellipse(rock.x + rock.w/2, rock.y + rock.h, rock.w * 0.6, rock.h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Rock body
      const rockGradient = ctx.createLinearGradient(rock.x, rock.y, rock.x, rock.y + rock.h);
      rockGradient.addColorStop(0, 'rgba(60, 60, 70, 1)');
      rockGradient.addColorStop(1, 'rgba(35, 35, 45, 1)');
      ctx.fillStyle = rockGradient;
      ctx.beginPath();
      ctx.ellipse(rock.x + rock.w/2, rock.y + rock.h/2, rock.w/2, rock.h/2, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Rock highlight
      ctx.fillStyle = 'rgba(80, 100, 120, 0.5)';
      ctx.beginPath();
      ctx.ellipse(rock.x + rock.w/3, rock.y + rock.h/3, rock.w/4, rock.h/4, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Lunar dust particles floating
    if (Math.random() > 0.8) {
      this.particles.push({
        x: Math.random() * this.W,
        y: this.H - 100 + Math.random() * 50,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 20,
        life: 1.5 + Math.random() * 1.0,
        color: 'rgba(150, 150, 160, 0.4)',
        size: 1 + Math.random() * 2
      });
    }
    
    // Add some glowing blue crystals on moon surface
    const crystals = [
      {x: 250, y: this.H - 20},
      {x: 480, y: this.H - 25},
      {x: 680, y: this.H - 18}
    ];
    
    crystals.forEach(crystal => {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00aaff';
      ctx.fillStyle = '#0088ff';
      ctx.beginPath();
      ctx.moveTo(crystal.x, crystal.y - 12);
      ctx.lineTo(crystal.x - 5, crystal.y);
      ctx.lineTo(crystal.x + 5, crystal.y);
      ctx.closePath();
      ctx.fill();
      
      // Crystal glow
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#00ddff';
      ctx.beginPath();
      ctx.moveTo(crystal.x, crystal.y - 10);
      ctx.lineTo(crystal.x - 3, crystal.y);
      ctx.lineTo(crystal.x + 3, crystal.y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });
    ctx.shadowBlur = 0;

    // Enhanced mascot with premium effects
    if (this.mascot.active) {
       const mY = Math.max(this.mascot.y, this.H - 120);
       
       // Add blue/red magical particles around mascot
       if (Math.random() > 0.5) {
         const angle = Math.random() * Math.PI * 2;
         const radius = 40 + Math.random() * 20;
         const particleColor = Math.random() > 0.5 ? 
           'rgba(0, 200, 255, 0.9)' : 'rgba(255, 50, 100, 0.85)';
         this.particles.push({
           x: this.W / 2 + Math.cos(angle) * radius,
           y: mY + Math.sin(angle) * radius,
           vx: Math.cos(angle) * 30,
           vy: Math.sin(angle) * 30 - 40,
           life: 1.0 + Math.random() * 0.5,
           color: particleColor,
           size: 2 + Math.random() * 3
         });
       }
       
       // Outer blue/red glow layer
       ctx.save();
       ctx.globalAlpha = 0.5;
       ctx.shadowBlur = 45;
       ctx.shadowColor = 'rgba(100, 50, 255, 1.0)';
       if (this.mascot.type === 'laugh') {
         const bob = Math.sin(this.mascot.timer * 20) * 8;
         const scale = 2.5 + Math.sin(this.mascot.timer * 15) * 0.15;
         ctx.translate(this.W / 2, mY + bob);
         ctx.scale(scale / 2.5, scale / 2.5);
         drawGrid(ctx, 0, 0, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
       } else {
         drawGrid(ctx, this.W / 2, mY, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
       }
       ctx.restore();
       
       // Main character with cyan glow
       ctx.globalAlpha = 1.0;
       ctx.shadowBlur = 32;
       ctx.shadowColor = 'rgba(0, 200, 255, 0.98)';
       if (this.mascot.type === 'laugh') {
         const bob = Math.sin(this.mascot.timer * 20) * 8;
         const scale = 2.5 + Math.sin(this.mascot.timer * 15) * 0.15;
         ctx.save();
         ctx.translate(this.W / 2, mY + bob);
         ctx.scale(scale / 2.5, scale / 2.5);
         drawGrid(ctx, 0, 0, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
         ctx.restore();
       } else {
         drawGrid(ctx, this.W / 2, mY, VIGILANTE_STAND, PALETTES.vigilante, false, 2.5);
       }
       ctx.shadowBlur = 0;
       ctx.globalAlpha = 1.0;
    }

    // Floating Texts (Scores & Taunts)
    ctx.textAlign = 'center';
    this.floatingTexts.forEach(ft => {
      ctx.font = ft.isTaunt ? 'bold 18px "Press Start 2P", monospace, sans-serif' : '14px "Press Start 2P", monospace, sans-serif';
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.life * 1.5));
      
      const textWidth = ctx.measureText(ft.text).width;
      let drawX = Math.max(textWidth / 2 + 20, Math.min(this.W - textWidth / 2 - 20, ft.x));

      if (ft.isTaunt) {
         ctx.fillStyle = 'rgba(10, 6, 20, 0.9)';
         ctx.fillRect(drawX - textWidth/2 - 20, ft.y - 24, textWidth + 40, 36);
         ctx.strokeStyle = '#e23636';
         ctx.lineWidth = 2;
         ctx.strokeRect(drawX - textWidth/2 - 20, ft.y - 24, textWidth + 40, 36);
      }

      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, drawX, ft.y);
      ctx.fillText(ft.text, drawX, ft.y);
    });
    ctx.globalAlpha = 1.0;
  }

  syncState() {
    if (this.updateReactState) {
      this.updateReactState({
        state: this.state,
        score: this.score,
        hiScore: this.hiScore,
        round: this.round,
        ammo: this.ammo,
        maxAmmo: this.maxAmmo,
        history: [...this.history],
        mode: this.mode,
        gameOverTaunt: this.gameOverTaunt
      });
    }
  }

  destroy() {
    cancelAnimationFrame(this.reqId);
  }
}

// --- REACT APP COMPONENT ---
const App = () => {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  
  const [gameState, setGameState] = useState({
    state: 'MENU',
    score: 0,
    hiScore: parseInt(localStorage.getItem('retroweb_hi')) || 0,
    round: 1,
    ammo: 5,
    maxAmmo: 5,
    history: new Array(10).fill('empty'),
    mode: 1,
    gameOverTaunt: ""
  });

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  const initEngine = useCallback(() => {
    if (engineRef.current) engineRef.current.destroy();
    engineRef.current = new GameEngine(canvasRef.current, setGameState);
    setGameState(prev => ({...prev, hiScore: engineRef.current.hiScore}));
  }, []);

  useEffect(() => {
    initEngine();
    return () => { if (engineRef.current) engineRef.current.destroy(); };
  }, [initEngine]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const eng = engineRef.current;
      if (!eng) return;
      
      switch(e.key.toLowerCase()) {
        case '1': if(eng.state === 'MENU') eng.startGame(1); break;
        case '2': if(eng.state === 'MENU') eng.startGame(2); break;
        case '3': if(eng.state === 'MENU') eng.startGame(3); break;
        case 'r': eng.startGame(eng.mode); break;
        case 'escape': 
          eng.state = 'MENU';
          eng.syncState();
          break;
        case ' ': 
          if (eng.state === 'PLAYING') eng.shoot(400, 225); // Shoot center
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCanvasClick = (e) => {
    const eng = engineRef.current;
    if (!eng || eng.state !== 'PLAYING') return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Add shooting animation to crosshair
    const gameArea = document.querySelector('.game-area');
    gameArea.classList.add('shooting');
    setTimeout(() => gameArea.classList.remove('shooting'), 150);
    
    eng.shoot(x, y);
  };

  // BUG 15 FIX: handle touch/pointer events for immediate mobile response
  const handlePointerDown = (e) => {
    // Prevent the 300ms delay and scroll interference on mobile
    e.preventDefault();
    const eng = engineRef.current;
    if (!eng || eng.state !== 'PLAYING') return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Add shooting animation to crosshair
    const gameArea = document.querySelector('.game-area');
    gameArea.classList.add('shooting');
    setTimeout(() => gameArea.classList.remove('shooting'), 150);

    eng.shoot(x, y);
  };

  // Track cursor position for custom crosshair
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const modeNames = { 1: "LEVEL 1: EASY", 2: "LEVEL 2: MEDIUM", 3: "LEVEL 3: VERY HARD" };

  return (
    <div className="game-area" onMouseMove={handleMouseMove}>
      <canvas ref={canvasRef} onClick={handleCanvasClick} onPointerDown={handlePointerDown} style={{touchAction: 'none'}} />
      
      {/* Custom Crosshair */}
      {gameState.state === 'PLAYING' && (
        <div className="custom-crosshair" style={{ left: `${cursorPos.x}px`, top: `${cursorPos.y}px` }}>
          <div className="crosshair-center"></div>
          <div className="crosshair-line crosshair-h"></div>
          <div className="crosshair-line crosshair-v"></div>
          <div className="crosshair-corner crosshair-tl"></div>
          <div className="crosshair-corner crosshair-tr"></div>
          <div className="crosshair-corner crosshair-bl"></div>
          <div className="crosshair-corner crosshair-br"></div>
        </div>
      )}
      
      <div className="crt-overlay"></div>
      <div id="screen-flash" className="flash"></div>

      {/* Top HUD Controls overlay over canvas directly */}
      {(gameState.state !== 'MENU') && (
        <div className="hud-top">
           <div></div>
           <div>
              <button className="btn" onClick={() => engineRef.current && engineRef.current.startGame(engineRef.current.mode)}>RESTART (R)</button>
              <button className="btn" onClick={() => {if(engineRef.current) {engineRef.current.state = 'MENU'; engineRef.current.syncState();}}}>MENU (ESC)</button>
           </div>
        </div>
      )}

      {gameState.state === 'MENU' && (
        <div className="overlay-screen">
          <h2 className="title">RETRO WEB HUNTER</h2>
          <p className="subtitle">Aim with mouse/finger · Click/Space to shoot</p>
          <div className="menu-opts">
            <div className="menu-opt" onClick={() => engineRef.current.startGame(1)}>LEVEL 1: EASY (Press 1)</div>
            <div className="menu-opt" onClick={() => engineRef.current.startGame(2)}>LEVEL 2: MEDIUM (Press 2)</div>
            <div className="menu-opt" onClick={() => engineRef.current.startGame(3)}>LEVEL 3: VERY HARD (Press 3)</div>
          </div>
        </div>
      )}

      {gameState.state === 'ROUND_START' && (
        <div className="overlay-screen" style={{background: 'rgba(5,3,10,0.6)'}}>
          <h2 className="title" style={{fontSize: '3vmin'}}>WAVE {gameState.round}</h2>
        </div>
      )}

      {gameState.state === 'GAME_OVER' && (
        <div className="overlay-screen">
          <h2 className="title" style={{color: 'var(--neon-red)'}}>GAME OVER</h2>
          <p style={{fontSize: '1.5vmin', marginBottom: '16px'}}>SCORE: {gameState.score}</p>
          <p style={{fontSize: '1.5vmin', color: '#f39c12', marginBottom: '32px', maxWidth: '80%', lineHeight: '1.6'}}>
            "{gameState.gameOverTaunt}"
          </p>
          <div className="menu-opt" onClick={() => engineRef.current.startGame(gameState.mode)}>TRY AGAIN (R)</div>
          <div className="menu-opt" style={{marginTop: '10px'}} onClick={() => {engineRef.current.state = 'MENU'; engineRef.current.syncState();}}>MENU (ESC)</div>
        </div>
      )}

      {(gameState.state !== 'MENU') && (
        <div className="hud-bottom">
          <div className="hud-left">
            <div><span className="text-highlight">WAVE {gameState.round}</span></div>
            <div style={{color: '#8ab4f8'}}>{modeNames[gameState.mode]}</div>
          </div>
          
          <div className="hud-center">
            {gameState.history.map((res, i) => (
              <div key={i} className={`hit-box ${res === 'hit' ? 'hit' : res === 'miss' ? 'miss' : ''}`} />
            ))}
          </div>

          <div className="hud-right" style={{textAlign: 'right'}}>
            <div>SCORE <span className="text-highlight">{gameState.score.toString().padStart(6, '0')}</span></div>
            <div>HI <span className="text-highlight">{gameState.hiScore.toString().padStart(6, '0')}</span></div>
          </div>

          <div className="ammo-container">
            {Array.from({length: gameState.maxAmmo}).map((_, i) => (
              <div key={i} className={`bullet-icon ${i >= gameState.ammo ? 'spent' : ''}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
