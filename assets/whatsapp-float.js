(function () {
  if (window.__agricheckWhatsappFloatLoaded) return;
  window.__agricheckWhatsappFloatLoaded = true;

  var WHATSAPP_URL = 'https://wa.me/+5492984763055?text=Hola%20AgriCheck!%20Quiero%20hacer%20una%20consulta.';
  var EVENT_NAME = 'whatsapp_bubble_click';

  var style = document.createElement('style');
  style.textContent = [
    '.ag-whatsapp-float{position:fixed;right:18px;bottom:18px;width:62px;height:62px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(0,0,0,.28);z-index:999;transition:transform .2s ease,box-shadow .2s ease;animation:ag-whatsapp-pop-in .6s ease-out .2s both}',
    '.ag-whatsapp-float img{width:30px;height:30px;display:block}',
    '.ag-whatsapp-float:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.32)}',
    '@keyframes ag-whatsapp-pop-in{0%{transform:translateY(12px) scale(.92)}55%{transform:translateY(-4px) scale(1.03)}100%{transform:translateY(0) scale(1)}}'
  ].join('');
  document.head.appendChild(style);

  var link = document.createElement('a');
  link.className = 'ag-whatsapp-float';
  link.href = WHATSAPP_URL;
  link.target = '_blank';
  link.rel = 'noopener';
  link.setAttribute('aria-label', 'Contactar por WhatsApp');
  link.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" />';

  link.addEventListener('click', function () {
    var payload = {
      event_category: 'contacto',
      event_label: 'floating_whatsapp',
      page_path: window.location.pathname,
      page_title: document.title
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: EVENT_NAME }, payload));

    if (typeof window.gtag === 'function') {
      window.gtag('event', EVENT_NAME, payload);
    }
  });

  document.body.appendChild(link);
})();
