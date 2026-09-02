export class AudioVisualizer {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioEngine = audioEngine;
    this.mode = 'bars'; // 'bars', 'circle', 'wave', 'particles', 'grid'
    this.accentColor = '#a855f7';
    this.secondaryColor = '#ec4899';
    this.animationId = null;

    // Peak hold physics for bars
    this.peaks = [];
    this.peakFallRate = 1.2;

    // Particle system
    this.particles = [];
    this.initParticles(70);

    // Audio data buffers
    this.bufferLength = 128;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.timeDomainArray = new Uint8Array(this.bufferLength);

    // Rotation angle for circular / 3D effects
    this.rotationAngle = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  setMode(mode) {
    this.mode = mode;
  }

  setAccentColor(color) {
    this.accentColor = color || '#a855f7';
    this.secondaryColor = this.generateSecondaryColor(this.accentColor);
  }

  generateSecondaryColor(hex) {
    const colorMap = {
      '#a855f7': '#06b6d4',
      '#ec4899': '#f59e0b',
      '#ef4444': '#8b5cf6',
      '#10b981': '#3b82f6',
      '#06b6d4': '#ec4899',
      '#f59e0b': '#ef4444',
      '#6366f1': '#10b981',
      '#14b8a6': '#f43f5e',
      '#8b5cf6': '#38bdf8'
    };
    return colorMap[hex] || '#38bdf8';
  }

  initParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * (this.width || 400),
        y: Math.random() * (this.height || 300),
        radius: Math.random() * 2.8 + 1.2,
        speedX: (Math.random() - 0.5) * 1.4,
        speedY: (Math.random() - 0.5) * 1.4,
        baseAlpha: Math.random() * 0.5 + 0.3,
        hueOffset: Math.random() * 60
      });
    }
  }

  start() {
    if (!this.animationId) {
      this.render();
    }
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  render() {
    this.animationId = requestAnimationFrame(() => this.render());

    if (!this.ctx || !this.width || !this.height) return;

    // Fetch live audio data
    this.audioEngine.getFrequencyData(this.dataArray);
    this.audioEngine.getTimeDomainData(this.timeDomainArray);

    // Calculate average energy in sub-bass and mids
    let subSum = 0;
    for (let i = 0; i < 12; i++) {
      subSum += this.dataArray[i];
    }
    const bassEnergy = subSum / 12; // 0 to 255

    let midSum = 0;
    for (let i = 12; i < 48; i++) {
      midSum += this.dataArray[i];
    }
    const midEnergy = midSum / 36;

    this.rotationAngle += 0.008 + (bassEnergy / 255) * 0.02;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    switch (this.mode) {
      case 'circle':
        this.renderCircular(bassEnergy, midEnergy);
        break;
      case 'wave':
        this.renderWaveform(bassEnergy);
        break;
      case 'particles':
        this.renderParticles(bassEnergy);
        break;
      case 'grid':
        this.renderCyberGrid(bassEnergy);
        break;
      case 'bars':
      default:
        this.renderBars(bassEnergy);
        break;
    }
  }

  renderBars(bassEnergy) {
    const barCount = 44;
    const barWidth = (this.width / barCount) * 0.68;
    const gap = (this.width / barCount) * 0.32;
    const startX = gap / 2;

    if (this.peaks.length !== barCount) {
      this.peaks = new Array(barCount).fill(0);
    }

    const baselineY = this.height * 0.85;

    // Dynamic vertical gradient for bars
    const gradient = this.ctx.createLinearGradient(0, baselineY, 0, 0);
    gradient.addColorStop(0, `${this.accentColor}22`);
    gradient.addColorStop(0.4, this.accentColor);
    gradient.addColorStop(1, this.secondaryColor);

    // Dynamic reflection gradient
    const reflectGrad = this.ctx.createLinearGradient(0, baselineY, 0, this.height);
    reflectGrad.addColorStop(0, `${this.accentColor}44`);
    reflectGrad.addColorStop(1, 'transparent');

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor(i * (this.bufferLength / barCount));
      const rawValue = this.dataArray[dataIndex] || 0;
      
      // Add dynamic curvature weighting for aesthetic high frequencies
      const freqWeight = 1 + Math.sin((i / barCount) * Math.PI) * 0.35;
      const value = Math.min(255, rawValue * freqWeight);
      
      const barHeight = Math.max(3, (value / 255) * (baselineY * 0.92));
      const x = startX + i * (barWidth + gap);
      const y = baselineY - barHeight;

      // Draw Main Bar with glow
      this.ctx.save();
      if (value > 140) {
        this.ctx.shadowColor = this.accentColor;
        this.ctx.shadowBlur = 10 * (value / 255);
      }
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      this.ctx.fill();
      this.ctx.restore();

      // Draw bottom reflection
      const reflectHeight = barHeight * 0.35;
      this.ctx.fillStyle = reflectGrad;
      this.ctx.beginPath();
      this.ctx.roundRect(x, baselineY + 2, barWidth, reflectHeight, [0, 0, 3, 3]);
      this.ctx.fill();

      // Peak Hold indicator
      if (barHeight >= this.peaks[i]) {
        this.peaks[i] = barHeight;
      } else {
        this.peaks[i] = Math.max(0, this.peaks[i] - this.peakFallRate);
      }

      const peakY = baselineY - this.peaks[i] - 3;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = this.secondaryColor;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.roundRect(x, peakY, barWidth, 2.5, [1, 1, 1, 1]);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }

    // Baseline accent line
    this.ctx.strokeStyle = `${this.accentColor}55`;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(0, baselineY);
    this.ctx.lineTo(this.width, baselineY);
    this.ctx.stroke();
  }

  renderCircular(bassEnergy, midEnergy) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const baseRadius = Math.min(centerX, centerY) * 0.38 + (bassEnergy / 255) * 22;
    const barCount = 56;

    // Glowing center ambient circle
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, baseRadius * 0.88, 0, Math.PI * 2);
    const radGrad = this.ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, baseRadius * 1.1);
    radGrad.addColorStop(0, `${this.accentColor}66`);
    radGrad.addColorStop(0.7, `${this.secondaryColor}22`);
    radGrad.addColorStop(1, 'transparent');
    this.ctx.fillStyle = radGrad;
    this.ctx.fill();

    // Pulsing core border
    this.ctx.strokeStyle = `${this.accentColor}`;
    this.ctx.lineWidth = 2 + (bassEnergy / 255) * 3;
    this.ctx.shadowColor = this.accentColor;
    this.ctx.shadowBlur = 20;
    this.ctx.stroke();
    this.ctx.restore();

    // Orbital spark ring
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(this.rotationAngle);

    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      const dataIndex = Math.floor(i * (this.bufferLength / barCount));
      const value = this.dataArray[dataIndex] || 0;
      const barLength = 5 + (value / 255) * (baseRadius * 0.95);

      const x1 = Math.cos(angle) * baseRadius;
      const y1 = Math.sin(angle) * baseRadius;
      const x2 = Math.cos(angle) * (baseRadius + barLength);
      const y2 = Math.sin(angle) * (baseRadius + barLength);

      this.ctx.strokeStyle = i % 2 === 0 ? this.accentColor : this.secondaryColor;
      this.ctx.lineWidth = 2.5;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();

      // Outer floating particle on strong beats
      if (value > 160) {
        const sparkRadius = baseRadius + barLength + 6;
        const sx = Math.cos(angle) * sparkRadius;
        const sy = Math.sin(angle) * sparkRadius;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    this.ctx.restore();
  }

  renderWaveform(bassEnergy) {
    this.ctx.save();

    const waveGrad = this.ctx.createLinearGradient(0, 0, this.width, 0);
    waveGrad.addColorStop(0, this.accentColor);
    waveGrad.addColorStop(0.5, this.secondaryColor);
    waveGrad.addColorStop(1, this.accentColor);

    // Render Area Fill
    this.ctx.beginPath();
    const sliceWidth = this.width / (this.timeDomainArray.length - 1);
    let x = 0;

    this.ctx.moveTo(0, this.height);
    for (let i = 0; i < this.timeDomainArray.length; i++) {
      const v = this.timeDomainArray[i] / 128.0; // 0 to 2
      const y = (v * (this.height / 2));

      if (i === 0) {
        this.ctx.lineTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    this.ctx.lineTo(this.width, this.height);
    this.ctx.closePath();

    const fillGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
    fillGrad.addColorStop(0, `${this.accentColor}55`);
    fillGrad.addColorStop(0.6, `${this.secondaryColor}22`);
    fillGrad.addColorStop(1, 'transparent');
    this.ctx.fillStyle = fillGrad;
    this.ctx.fill();

    // Render Neon Top Stroke
    this.ctx.beginPath();
    x = 0;
    for (let i = 0; i < this.timeDomainArray.length; i++) {
      const v = this.timeDomainArray[i] / 128.0;
      const y = (v * (this.height / 2));
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    this.ctx.strokeStyle = waveGrad;
    this.ctx.lineWidth = 3 + (bassEnergy / 255) * 2;
    this.ctx.shadowColor = this.secondaryColor;
    this.ctx.shadowBlur = 18;
    this.ctx.stroke();

    this.ctx.restore();
  }

  renderParticles(bassEnergy) {
    const energyNorm = bassEnergy / 255;
    this.ctx.save();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      const speedMultiplier = 1 + energyNorm * 3.5;
      p.x += p.speedX * speedMultiplier;
      p.y += p.speedY * speedMultiplier;

      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      const currentRadius = p.radius * (1 + energyNorm * 1.8);
      const alpha = Math.min(1, p.baseAlpha + energyNorm * 0.45);

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = i % 2 === 0 ? this.accentColor : this.secondaryColor;
      this.ctx.globalAlpha = alpha;
      this.ctx.shadowColor = this.accentColor;
      this.ctx.shadowBlur = 10 * (1 + energyNorm);
      this.ctx.fill();

      // Connect near particles
      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        const maxDist = 70 + energyNorm * 50;

        if (dist < maxDist) {
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = this.accentColor;
          this.ctx.globalAlpha = (1 - dist / maxDist) * 0.35 * (1 + energyNorm);
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      }
    }

    this.ctx.restore();
  }

  renderCyberGrid(bassEnergy) {
    const energyNorm = bassEnergy / 255;
    this.ctx.save();

    const horizonY = this.height * 0.45;
    const vLines = 22;
    const hLines = 14;

    // Horizon glowing sun
    const sunGrad = this.ctx.createRadialGradient(
      this.width / 2, horizonY, 5,
      this.width / 2, horizonY, this.height * 0.45
    );
    sunGrad.addColorStop(0, `${this.accentColor}cc`);
    sunGrad.addColorStop(0.5, `${this.secondaryColor}44`);
    sunGrad.addColorStop(1, 'transparent');
    this.ctx.fillStyle = sunGrad;
    this.ctx.fillRect(0, 0, this.width, horizonY + 20);

    // Horizon beam line
    this.ctx.strokeStyle = this.secondaryColor;
    this.ctx.lineWidth = 2 + energyNorm * 2;
    this.ctx.shadowColor = this.secondaryColor;
    this.ctx.shadowBlur = 15;
    this.ctx.beginPath();
    this.ctx.moveTo(0, horizonY);
    this.ctx.lineTo(this.width, horizonY);
    this.ctx.stroke();

    // Perspective Vertical lines radiating from horizon center
    const centerX = this.width / 2;
    this.ctx.strokeStyle = `${this.accentColor}66`;
    this.ctx.lineWidth = 1.2;

    for (let i = 0; i <= vLines; i++) {
      const bottomX = (i / vLines) * this.width * 1.6 - this.width * 0.3;
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, horizonY);
      this.ctx.lineTo(bottomX, this.height);
      this.ctx.stroke();
    }

    // Moving horizontal grid lines
    const speedOffset = (Date.now() * 0.05 * (1 + energyNorm)) % 30;
    for (let i = 0; i < hLines; i++) {
      const progress = (i * 30 + speedOffset) / (hLines * 30);
      const y = horizonY + Math.pow(progress, 2.2) * (this.height - horizonY);
      const lineAlpha = progress * (0.3 + energyNorm * 0.5);

      this.ctx.strokeStyle = this.accentColor;
      this.ctx.globalAlpha = lineAlpha;
      this.ctx.lineWidth = 1 + progress * 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }

    // Audio frequency mountain skyline along horizon
    this.ctx.globalAlpha = 0.85;
    this.ctx.fillStyle = `${this.secondaryColor}88`;
    this.ctx.beginPath();
    this.ctx.moveTo(0, horizonY);
    const step = this.width / 32;
    for (let i = 0; i <= 32; i++) {
      const val = this.dataArray[i * 2] || 0;
      const h = (val / 255) * 55 * (1 + energyNorm);
      this.ctx.lineTo(i * step, horizonY - h);
    }
    this.ctx.lineTo(this.width, horizonY);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }
}

/**
 * Dedicated live spectrum renderer for the Equalizer modal
 */
export function renderEqModalSpectrum(canvas, dataArray, bassGain = 0, midGain = 0, trebleGain = 0) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }

  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const barCount = 32;
  const barWidth = (width / barCount) * 0.72;
  const gap = (width / barCount) * 0.28;
  const startX = gap / 2;

  // Background subtle grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  for (let y = 20; y < height; y += 25) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw Equalizer Frequency Response Curve Overlay
  ctx.beginPath();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 10;

  for (let i = 0; i <= barCount; i++) {
    const x = (i / barCount) * width;
    let gainInfluence = 0;
    if (i < barCount * 0.33) {
      gainInfluence = (bassGain / 12) * (height * 0.35);
    } else if (i < barCount * 0.66) {
      gainInfluence = (midGain / 12) * (height * 0.35);
    } else {
      gainInfluence = (trebleGain / 12) * (height * 0.35);
    }
    const curveY = height * 0.5 - gainInfluence;
    if (i === 0) ctx.moveTo(x, curveY);
    else ctx.lineTo(x, curveY);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Draw 32 Real-Time Spectrum Bars
  const grad = ctx.createLinearGradient(0, height, 0, 0);
  grad.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
  grad.addColorStop(0.5, '#a855f7');
  grad.addColorStop(1, '#ec4899');

  for (let i = 0; i < barCount; i++) {
    const dataIdx = Math.floor(i * (dataArray.length / barCount));
    const raw = dataArray[dataIdx] || 0;
    
    // Boost visual with user EQ settings
    let eqBoost = 1.0;
    if (i < 10) eqBoost += (bassGain / 12) * 0.4;
    else if (i < 22) eqBoost += (midGain / 12) * 0.4;
    else eqBoost += (trebleGain / 12) * 0.4;

    const val = Math.min(255, Math.max(0, raw * eqBoost));
    const barHeight = Math.max(4, (val / 255) * (height * 0.88));
    const x = startX + i * (barWidth + gap);
    const y = height - barHeight;

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
    ctx.fill();

    // Top glowing cap
    if (val > 80) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ec4899';
      ctx.shadowBlur = 6;
      ctx.fillRect(x, y - 2, barWidth, 2);
      ctx.shadowBlur = 0;
    }
  }
}
