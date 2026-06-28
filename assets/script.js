// ===========================================================
// Akatsuki Tech — comportamentos compartilhados
// ===========================================================

document.addEventListener('DOMContentLoaded', () => {
  // Menu mobile
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    links.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => links.classList.remove('open'));
    });
  }

  // Reveal on scroll
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  // Formulário de contato — envia para o Formspree (e-mail)
  const form = document.querySelector('#contact-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const feedback = document.querySelector('#form-feedback');
      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.textContent;

      // Validação nativa do navegador antes de qualquer tentativa de envio
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Detecta se o endpoint do Formspree ainda não foi configurado
      // (placeholder não substituído pelo código real do formulário)
      if (!form.action || form.action.includes('SEU_CODIGO_AQUI')) {
        console.error(
          '[Akatsuki Tech] O formulário de contato não está configurado: ' +
          'substitua "SEU_CODIGO_AQUI" no atributo action do <form id="contact-form"> ' +
          'pelo código real gerado em https://formspree.io'
        );
        if (feedback) {
          feedback.textContent = 'O envio por e-mail ainda não foi configurado. Use o botão do WhatsApp abaixo, por favor.';
          feedback.style.color = 'var(--warn)';
          feedback.classList.add('show');
        }
        return;
      }

      btn.textContent = 'Enviando...';
      btn.disabled = true;
      if (feedback) feedback.classList.remove('show');

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });

        if (response.ok) {
          form.reset();
          if (window.akatsukiAudio) window.akatsukiAudio.playSuccess();
          if (feedback) {
            feedback.textContent = 'Pedido enviado por e-mail! Retornamos em breve pelo telefone informado.';
            feedback.style.color = 'var(--ok)';
            feedback.classList.add('show');
          }
        } else {
          // Tenta extrair detalhe do erro retornado pelo Formspree para log de diagnóstico
          let detail = `HTTP ${response.status}`;
          try {
            const data = await response.json();
            if (data && data.errors) {
              detail += ' — ' + data.errors.map((er) => er.message).join('; ');
            }
          } catch (_) {
            // resposta sem corpo JSON, mantém só o status
          }
          console.error('[Akatsuki Tech] Falha ao enviar formulário:', detail);
          throw new Error(detail);
        }
      } catch (err) {
        console.error('[Akatsuki Tech] Erro de rede ou envio:', err);
        if (feedback) {
          feedback.textContent = 'Não foi possível enviar por e-mail agora. Tente pelo botão do WhatsApp abaixo, ou verifique sua conexão.';
          feedback.style.color = 'var(--warn)';
          feedback.classList.add('show');
        }
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }
});
