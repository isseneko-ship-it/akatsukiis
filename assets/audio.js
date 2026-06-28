// ===========================================================
// Akatsuki Tech — áudio (música de fundo única + sons de interface)
//
// Usa UMA música de longa duração (ex: 45 minutos) tocando em todas as
// páginas. Como o navegador recarrega a página inteira a cada navegação
// (isso não é uma SPA), o áudio em si é recriado a cada troca de página —
// então, para a música parecer contínua, o tempo atual é salvo a cada poucos
// segundos e, ao carregar a próxima página, a reprodução pula automaticamente
// para esse mesmo ponto. Pode haver um pulinho de menos de 1 segundo na
// troca, mas a experiência geral é de uma música "sem fim" tocando o tempo
// todo enquanto a pessoa navega pelo site.
//
// Por política de todos os navegadores, áudio com som só pode iniciar depois
// de uma interação do usuário (clique) — por isso a música começa a tocar no
// primeiro clique na página, não automaticamente ao carregar.
//
// COMO TROCAR A MÚSICA:
// 1. Coloque seu arquivo .mp3 dentro da pasta assets/music/
// 2. Use exatamente este nome de arquivo: assets/music/trilha.mp3
//    (ou ajuste o valor de MUSIC_FILE abaixo, se preferir outro nome)
// 3. Pronto — não precisa alterar mais nada neste arquivo.
// ===========================================================

(() => {
  const STORAGE_KEY_MUTED = 'akatsuki_audio_muted';
  const STORAGE_KEY_TIME = 'akatsuki_audio_time';
  const VOLUME = 0.35; // volume da música de fundo (0 a 1)
  const SAVE_INTERVAL_MS = 1500; // a cada quanto tempo salva o ponto atual da música

  const MUSIC_FILE = 'assets/music/trilha.mp3';

  function isMuted() {
    return localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
  }

  function setMuted(value) {
    localStorage.setItem(STORAGE_KEY_MUTED, value ? 'true' : 'false');
  }

  function getSavedTime() {
    const saved = parseFloat(localStorage.getItem(STORAGE_KEY_TIME));
    return Number.isFinite(saved) ? saved : 0;
  }

  function setSavedTime(seconds) {
    localStorage.setItem(STORAGE_KEY_TIME, String(seconds));
  }

  class AkatsukiAudio {
    constructor() {
      this.musicEl = null;
      this.sfxCtx = null; // contexto separado, só para os efeitos curtos gerados por código
      this.started = false;
      this.saveTimer = null;
    }

    ensureSfxContext() {
      if (!this.sfxCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.sfxCtx = new AudioCtx();
      }
      if (this.sfxCtx.state === 'suspended') {
        this.sfxCtx.resume();
      }
    }

    ensureMusicElement() {
      if (this.musicEl) return;

      this.musicEl = document.createElement('audio');
      this.musicEl.loop = true; // se a música de 45min terminar, recomeça do zero
      this.musicEl.volume = VOLUME;
      this.musicEl.preload = 'auto';
      document.body.appendChild(this.musicEl);

      // Salva o tempo atual periodicamente, para a próxima página retomar daqui.
      this.saveTimer = setInterval(() => {
        if (this.musicEl && !this.musicEl.paused) {
          setSavedTime(this.musicEl.currentTime);
        }
      }, SAVE_INTERVAL_MS);

      // Também salva ao saber que a pessoa está saindo da página (clique em
      // link, fechar aba etc.), para não perder até 1.5s de progresso.
      window.addEventListener('pagehide', () => {
        if (this.musicEl) setSavedTime(this.musicEl.currentTime);
      });
    }

    // Carrega o arquivo e garante que o ponto salvo seja aplicado ANTES de
    // qualquer chamada a play() — se o seek for feito depois de já estar
    // tocando, a reprodução pode "vencer a corrida" e a música acaba
    // continuando do zero em vez de retomar o ponto certo.
    loadAndSeek() {
      return new Promise((resolve) => {
        const saved = getSavedTime();

        if (saved <= 0) {
          this.musicEl.src = MUSIC_FILE;
          resolve();
          return;
        }

        let attempts = 0;
        const maxAttempts = 20;

        const trySeek = () => {
          attempts++;
          if (!this.musicEl.duration || saved >= this.musicEl.duration) {
            resolve();
            return;
          }
          this.musicEl.currentTime = saved;
        };

        const onSeeked = () => {
          // Confirma se o navegador de fato aceitou o valor (em conexões
          // lentas, o trecho de destino pode ainda não estar bufferizado e o
          // seek acaba sendo ignorado — por isso a confirmação e o retry).
          const diff = Math.abs(this.musicEl.currentTime - saved);
          if (diff < 1 || attempts >= maxAttempts) {
            this.musicEl.removeEventListener('seeked', onSeeked);
            this.musicEl.removeEventListener('canplay', onCanPlay);
            resolve();
          } else {
            setTimeout(trySeek, 150);
          }
        };

        const onCanPlay = () => {
          trySeek();
        };

        this.musicEl.addEventListener('seeked', onSeeked);
        this.musicEl.addEventListener('canplay', onCanPlay, { once: true });
        this.musicEl.src = MUSIC_FILE;

        // Rede de segurança: se nada disparar em 4s (ex: conexão muito lenta),
        // resolve mesmo assim para não deixar a música presa sem tocar.
        setTimeout(resolve, 4000);
      });
    }

    startLoop() {
      this.ensureMusicElement();
      if (isMuted()) return;

      const beginPlayback = () => {
        const playPromise = this.musicEl.play();
        if (playPromise && playPromise.catch) {
          playPromise.catch((err) => {
            // Reprodução pode falhar se o arquivo ainda não existir em assets/music/
            // (placeholder não substituído) ou se o navegador bloquear o autoplay.
            console.warn(
              `[Akatsuki Tech] Não foi possível tocar a música "${MUSIC_FILE}". ` +
              `Confirme se o arquivo existe em assets/music/. Detalhe: ${err.message}`
            );
          });
        }
      };

      if (!this.musicEl.src) {
        // Primeira vez carregando nesta página: espera o seek terminar antes de dar play.
        this.loadAndSeek().then(beginPlayback);
      } else {
        beginPlayback();
      }
      this.started = true;
    }

    stopLoop() {
      if (this.musicEl) {
        setSavedTime(this.musicEl.currentTime);
        this.musicEl.pause();
      }
      this.started = false;
    }

    // Som curto de sucesso (ex: formulário enviado) — sequência ascendente de 3 notas.
    // Gerado por código, não depende de arquivo.
    playSuccess() {
      this.ensureSfxContext();
      const notes = [523, 659, 784]; // dó, mi, sol — soa "positivo"
      notes.forEach((freq, i) => {
        const osc = this.sfxCtx.createOscillator();
        const gain = this.sfxCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const start = this.sfxCtx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
        osc.connect(gain);
        gain.connect(this.sfxCtx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    }

    // Clique de UI curto e discreto. Gerado por código, não depende de arquivo.
    playClick() {
      this.ensureSfxContext();
      const osc = this.sfxCtx.createOscillator();
      const gain = this.sfxCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, this.sfxCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, this.sfxCtx.currentTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.sfxCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxCtx.destination);
      osc.start();
      osc.stop(this.sfxCtx.currentTime + 0.1);
    }
  }

  const audio = new AkatsukiAudio();
  window.akatsukiAudio = audio; // exposto para outros scripts (ex: feedback de envio)

  const ICON_ON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 9V15H8L13 19V5L8 9H4Z" fill="currentColor"/><path d="M16.5 8.5C17.5 9.5 17.5 14.5 16.5 15.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M19 6C21 8 21 16 19 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const ICON_MUTED = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 9V15H8L13 19V5L8 9H4Z" fill="currentColor"/><path d="M16 8L21 13M21 8L16 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;

  function buildMuteButton() {
    const btn = document.createElement('button');
    btn.id = 'audio-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Ativar ou desativar música de fundo');
    btn.innerHTML = isMuted() ? ICON_MUTED : ICON_ON;
    document.body.appendChild(btn);
    return btn;
  }

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

    // Inicia a música assim que a página carrega — o clique no link/botão que
    // trouxe a pessoa até aqui já conta, para o navegador, como a interação
    // necessária para liberar áudio com som. Isso é o que permite a sensação
    // de continuidade ao trocar de página.
    if (!isMuted()) {
      audio.startLoop();
    }

    // Mesmo assim, mantém um fallback: se o navegador ainda bloquear (ex:
    // pessoa abriu o link em uma aba nova, ou chegou direto pela URL sem
    // nenhuma interação prévia), a música inicia no primeiro clique.
    function tryStartOnFirstInteraction() {
      if (!isMuted() && audio.musicEl && audio.musicEl.paused) {
        audio.startLoop();
      }
      document.removeEventListener('click', tryStartOnFirstInteraction);
      document.removeEventListener('keydown', tryStartOnFirstInteraction);
    }
    document.addEventListener('click', tryStartOnFirstInteraction);
    document.addEventListener('keydown', tryStartOnFirstInteraction);
  });
})();
