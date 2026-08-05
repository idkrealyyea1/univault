// =====================================================================
// UniVault — Cyber theme JS (§11)
// Loaded ONLY on UCAS → Cybersecurity & Information Security Engineering.
// Matrix rain, boot sequence, glitch headings.
// =====================================================================
(function () {
  if (document.documentElement.classList.contains('theme-cyber')) initCyberTheme();

  function initCyberTheme() {
    addFonts();
    startMatrixRain();
    runBootSequence();
    addGlitchToHeadings();
  }

  // Google Fonts — monospace for the theme
  function addFonts() {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  // ---- 11.2 Digital rain ----
  function startMatrixRain() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const chars = '01アイウエオカキクケコ$#@!%&';
    const fontSize = 16;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);

    function draw() {
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; // trail fade
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff41';
      ctx.font = fontSize + 'px monospace';
      drops.forEach((y, i) => {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, y * fontSize);
        if (y * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    }
    setInterval(draw, 40);
  }

  // ---- 11.3 Boot sequence ----
  function runBootSequence() {
    const lines = [
      'INITIALIZING SECURE ACCESS...',
      'ESTABLISHING ENCRYPTED TUNNEL... OK',
      'VERIFYING CREDENTIALS...',
      'CHECKING FIREWALL RULES... OK',
      'DECRYPTING SESSION KEYS... OK',
      'ACCESS GRANTED'
    ];

    const overlay = document.createElement('div');
    overlay.id = 'cyber-boot';
    const pre = document.createElement('pre');
    overlay.appendChild(pre);
    document.body.prepend(overlay);

    let lineIndex = 0;
    let charIndex = 0;

    function typeLine() {
      const line = lines[lineIndex];
      if (charIndex < line.length) {
        charIndex++;
        pre.textContent = lines.slice(0, lineIndex).join('\n') + '\n' + line.slice(0, charIndex);
        setTimeout(typeLine, 24 + Math.random() * 30);
      } else {
        lineIndex++;
        charIndex = 0;
        if (lineIndex < lines.length) {
          setTimeout(typeLine, 180);
        } else {
          setTimeout(function () {
            overlay.style.transition = 'opacity 0.6s';
            overlay.style.opacity = '0';
            setTimeout(function () { overlay.remove(); }, 700);
          }, 500);
        }
      }
    }
    typeLine();
  }

  // ---- 11.3 Glitch headings ----
  function addGlitchToHeadings() {
    document.querySelectorAll('h1, h2').forEach(function (h) {
      if (h.classList.contains('glitch')) return;
      const text = h.textContent;
      h.classList.add('glitch');
      h.setAttribute('data-text', text);
    });
  }
})();
