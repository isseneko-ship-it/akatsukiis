// ===========================================================
// Akatsuki Tech — áudio (música de fundo gerada por código + sons de interface)
//
// Não usa nenhum arquivo de música externo: todo som é sintetizado em tempo
// real pela Web Audio API (osciladores simples), então não há problema de
// direitos autorais e não é preciso hospedar nenhum .mp3.
//
// Por política de todos os navegadores, áudio com som só pode iniciar depois
// de uma interação do usuário (clique) — por isso a música começa a tocar no
// primeiro clique na página, não automaticamente ao carregar.
// ===========================================================

(() => {
  const STORAGE_KEY = 'akatsuki_audio_muted';

  // Uma "vibe" (escala + andamento) diferente por página, pra dar variedade
  // ao navegar pelo site.
  const VIBES = {
    'index.html':     { notes: [220, 277, 330, 277, 392, 330, 277, 220], tempo: 0.34, wave: 'sawtooth' },
    'sobre.html':      { notes: [196, 247, 294, 247, 220, 247, 196, 174], tempo: 0.42, wave: 'triangle' },
    'portfolio.html':  { notes: [246, 293, 369, 293, 246, 195, 246, 293], tempo: 0.30, wave: 'square'   },
    'contato.html':    { notes: [261, 329, 392, 329, 440, 392, 329, 261], tempo: 0.36, wave: 'sawtooth' },
  };

  function currentPageKey() {
    const path = window.location.pathname.split('/').pop();
    return VIBES[path] ? path : 'index.html';
  }

  function isMuted() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }

  function setMuted(value) {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  }

  class AkatsukiAudio {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.loopTimer = null;
      this.stepIndex = 0;
      this.started = false;
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.05; // volume baixo, é fundo, não protagonista
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    // Toca uma nota curta (um "step" do loop)
    playStep(freq, wave, duration) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + duration + 0.05);
    }

    startLoop() {
      if (this.started) return;
      this.ensureContext();
      this.started = true;

      const vibe = VIBES[currentPageKey()];
      this.stepIndex = 0;

      const step = () => {
        if (isMuted()) return;
        const freq = vibe.notes[this.stepIndex % vibe.notes.length];
        this.playStep(freq, vibe.wave, vibe.tempo * 0.85);
        this.stepIndex++;
      };

      step();
      this.loopTimer = setInterval(step, vibe.tempo * 1000);
    }

    stopLoop() {
      if (this.loopTimer) {
        clearInterval(this.loopTimer);
        this.loopTimer = null;
      }
      this.started = false;
    }

    // Som curto de sucesso (ex: formulário enviado) — sequência ascendente de 3 notas
    playSuccess() {
      this.ensureContext();
      const notes = [523, 659, 784]; // dó, mi, sol — soa "positivo"
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const start = this.ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    }

    // Clique de UI curto e discreto
    playClick() {
      this.ensureContext();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, this.ctx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    }
  }

  const audio = new AkatsukiAudio();
  window.akatsukiAudio = audio; // exposto para outros scripts (ex: feedback de envio)

  function buildMuteButton() {
    const btn = document.createElement('button');
    btn.id = 'audio-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Ativar ou desativar música de fundo');
    btn.innerHTML = isMuted() ? ICON_MUTED : ICON_ON;
    document.body.appendChild(btn);
    return btn;
  }

  const ICON_ON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 9V15H8L13 19V5L8 9H4Z" fill="currentColor"/><path d="M16.5 8.5C17.5 9.5 17.5 14.5 16.5 15.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M19 6C21 8 21 16 19 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const ICON_MUTED = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 9V15H8L13 19V5L8 9H4Z" fill="currentColor"/><path d="M16 8L21 13M21 8L16 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

  document.addEventListener('DOMContentLoaded', () => {
    const btn = buildMuteButton();

    function refreshIcon() {
      btn.innerHTML = isMuted() ? ICON_MUTED : ICON_ON;
      btn.classList.toggle('muted', isMuted());
    }
    refreshIcon();

    btn.addEventListener('click', () => {
      const nextMuted = !isMuted();
      setMuted(nextMuted);
      refreshIcon();
      if (nextMuted) {
        audio.stopLoop();
      } else {
        audio.startLoop();
      }
    });

    // Primeira interação da pessoa com a página inicia a música
    // (exigência dos navegadores: áudio só após gesto do usuário)
    function tryStartOnFirstInteraction() {
      if (!isMuted()) {
        audio.startLoop();
      }
      document.removeEventListener('click', tryStartOnFirstInteraction);
      document.removeEventListener('keydown', tryStartOnFirstInteraction);
    }
    document.addEventListener('click', tryStartOnFirstInteraction);
    document.addEventListener('keydown', tryStartOnFirstInteraction);
  });
})();
