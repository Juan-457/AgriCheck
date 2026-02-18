(function () {
  try {
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;

    var hasLlmsLink = head.querySelector('link[rel="alternate"][href="/llms.txt"]');
    if (!hasLlmsLink) {
      var llms = document.createElement('link');
      llms.setAttribute('rel', 'alternate');
      llms.setAttribute('type', 'text/markdown');
      llms.setAttribute('href', '/llms.txt');
      llms.setAttribute('title', 'Contexto para LLMs');
      head.appendChild(llms);
    }

    var hasJsonLd = head.querySelector('script[type="application/ld+json"][data-ai="webpage"]');
    if (!hasJsonLd) {
      var canonical = head.querySelector('link[rel="canonical"]');
      var desc = head.querySelector('meta[name="description"]');
      var ld = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: (document.title || '').trim(),
        description: desc ? (desc.getAttribute('content') || '').trim() : '',
        url: canonical ? (canonical.getAttribute('href') || '').trim() : window.location.href,
        inLanguage: (document.documentElement && document.documentElement.lang) || 'es-AR',
        isPartOf: {
          '@type': 'WebSite',
          name: 'AgriCheck',
          url: (window.location.origin || '') + '/'
        },
        about: {
          '@type': 'Thing',
          name: 'Agroinsumos especiales y agricultura sustentable'
        }
      };

      var script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-ai', 'webpage');
      script.text = JSON.stringify(ld);
      head.appendChild(script);
    }
  } catch (_) {
    // noop
  }
})();
