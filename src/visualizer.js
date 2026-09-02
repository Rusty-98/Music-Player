export class AudioVisualizer {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioEngine = audioEngine;
    this.mode = 'bars'; // 'bars', 'circle', 'wave', 'particles'
    this.accentColor = '#a855f7';
    this.secondaryColor = '#ec4899';
    this.animationId = null;

    // Peak hold physics for bars
    this.peaks = [];
    this.peakFallRate = 1.5;

    // Particle system
    this.particles = [];
    this.initParticles(60);

    // Audio data buffers
    this.bufferLength = 128;
    this.dataArray = new Uint8Array(this.bufferLength);
    this.timeDomainArray = new Uint8Array(this.bufferLength);

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
    // Generate complementary secondary color
    this.secondaryColor = this.generateSecondaryColor(this.accentColor);
  }

  generateSecondaryColor(hex) {
    // Simple hue shift for vibrant dual gradients
    return hex === '#a855f7' ? '#06b6d4' :
           hex === '#ec4899' ? '#f59e0b' :
           hex === '#ef4444' ? '#8b5cf6' :
           hex === '#10b981' ? '#3b82f6' :
           hex === '#06b6d4' ? '#ec4899' : '#a855f7';
  }

  initParticles(count) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * (this.width || 400),
        y: Math.random() * (this.height || 300),
        radius: Math.random() * 3 + 1.5,
        speedX: (Math.random() - 0.5) * 1.2,
        speedY: (Math.random() - 0.5) * 1.2,
        baseAlpha: Math.random() * 0.6 + 0.3,
        alpha: 0.5
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

    // Calculate average bass / energy
    let sum = 0;
    for (let i = 0; i < 16; i++) {
      sum += this.dataArray[i];
    }
    const bassEnergy = sum / 16; // 0 to 255

    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    switch (this.mode) {
      case 'circle':
        this.renderCircular(bassEnergy);
        break;
      case 'wave':
        this.renderWaveform(bassEnergy);
        break;
      case 'particles':
        this.renderParticles(bassEnergy);
        break;
      case 'bars':
      default:
        this.renderBars(bassEnergy);
        break;
    }
  }

  renderBars(bassEnergy) {
    const barCount = 48;
    const barWidth = (this.width / barCount) * 0.7;
    const gap = (this.width / barCount) * 0.3;
    const startX = gap / 2;

    if (this.peaks.length !== barCount) {
      this.peaks = new Array(barCount).fill(0);
    }

    // Dynamic gradient
    const gradient = this.ctx.createLinearGradient(0, this.height, 0, 0);
    gradient.addColorStop(0, `${this.accentColor}33`);
    gradient.addColorStop(0.5, this.accentColor);
    gradient.addColorStop(1, this.secondaryColor);

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor(i * (this.bufferLength / barCount));
      const value = this.dataArray[dataIndex] || 0;
      const barHeight = Math.max(4, (value / 255) * (this.height * 0.82));
      const x = startX + i * (barWidth + gap);
      const y = this.height - barHeight;

      // Draw Main Bar with rounded top
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      this.ctx.fill();

      // Peak Hold indicator
      if (barHeight >= this.peaks[i]) {
        this.peaks[i] = barHeight;
      } else {
        this.peaks[i] = Math.max(0, this.peaks[i] - this.peakFallRate);
      }

      const peakY = this.height - this.peaks[i] - 3;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = this.secondaryColor;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.roundRect(x, peakY, barWidth, 2.5, [1, 1, 1, 1]);
      this.ctx.fill();
      this.ctx.shadowBlur = 0; // reset
    }
  }

  renderCircular(bassEnergy) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const baseRadius = Math.min(centerX, centerY) * 0.42 + (bassEnergy / 255) * 18;
    const barCount = 64;

    // Glowing center ambient circle
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, baseRadius * 0.85, 0, Math.PI * 2);
    const radGrad = this.ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, baseRadius);
    radGrad.addColorStop(0, `${this.accentColor}55`);
    radGrad.addColorStop(1, 'transparent');
    this.ctx.fillStyle = radGrad;
    this.ctx.fill();

    // Pulsing core border
    this.ctx.strokeStyle = `${this.accentColor}88`;
    this.ctx.lineWidth = 2 + (bassEnergy / 255) * 3;
    this.ctx.shadowColor = this.accentColor;
    this.ctx.shadowBlur = 15;
    this.ctx.stroke();
    this.ctx.restore();

    // Radial Bars
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      const dataIndex = Math.floor(i * (this.bufferLength / barCount));
      const value = this.dataArray[dataIndex] || 0;
      const barLength = 6 + (value / 255) * (baseRadius * 0.95);

      const x1 = centerX + Math.cos(angle) * baseRadius;
      const y1 = centerY + Math.sin(angle) * baseRadius;
      const x2 = centerX + Math.cos(angle) * (baseRadius + barLength);
      const y2 = centerY + Math.sin(angle) * (baseRadius + barLength);

      this.ctx.strokeStyle = i % 2 === 0 ? this.accentColor : this.secondaryColor;
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }
  }

  renderWaveform(bassEnergy) {
    this.ctx.save();

    // Background soft glow
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
    fillGrad.addColorStop(0, `${this.accentColor}44`);
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
    this.ctx.shadowBlur = 16;
    this.ctx.stroke();

    this.ctx.restore();
  }

  renderParticles(bassEnergy) {
    const energyNorm = bassEnergy / 255;
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    this.ctx.save();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Update particle positions reacting to bass
      const speedMultiplier = 1 + energyNorm * 3.5;
      p.x += p.speedX * speedMultiplier;
      p.y += p.speedY * speedMultiplier;

      // Wrap around bounds
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      // Dynamic radius and glow
      const currentRadius = p.radius * (1 + energyNorm * 1.8);
      const alpha = Math.min(1, p.baseAlpha + energyNorm * 0.4);

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = i % 2 === 0 ? `${this.accentColor}` : `${this.secondaryColor}`;
      this.ctx.globalAlpha = alpha;
      this.ctx.shadowColor = this.accentColor;
      this.ctx.shadowBlur = 8 * (1 + energyNorm);
      this.ctx.fill();

      // Connect near particles
      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
        const maxDist = 70 + energyNorm * 40;

        if (dist < maxDist) {
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = this.accentColor;
          this.ctx.globalAlpha = (1 - dist / maxDist) * 0.3 * (1 + energyNorm);
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      }
    }

    this.ctx.restore();
  }
}
