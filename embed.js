/* TapIN website embed. Usage:
   <div class="tapin-events" data-org="your-slug" data-layout="list"></div>
   <div class="tapin-events" data-event="EVENT_ID"></div>
   <script src="https://app.tapin2events.com/embed.js" async></script>
   <div class="tapin-events" data-org="your-slug" data-view="page"></div>   (your full organization page)
   Optional: data-layout="list|grid|calendar", data-theme="light|dark", data-brand="1", data-badge="0" */
(function () {
  var BASE = 'https://app.tapin2events.com';
  var n = 0;
  function mount(el) {
    if (el.getAttribute('data-tapin-mounted')) return;
    el.setAttribute('data-tapin-mounted', '1');
    var id = 'tapin-embed-' + (++n) + '-' + Math.random().toString(36).slice(2, 7);
    var q = ['frame=' + id];
    ['layout', 'theme', 'brand', 'badge'].forEach(function (k) { var v = el.getAttribute('data-' + k); if (v) q.push(k + '=' + encodeURIComponent(v)); });
    var org = el.getAttribute('data-org'), ev = el.getAttribute('data-event');
    if (!org && !ev) return;
    var page = !ev && el.getAttribute('data-view') === 'page';
    var src = BASE + (ev ? '/embed/event/' + encodeURIComponent(ev) : (page ? '/embed/page/' : '/embed/org/') + encodeURIComponent(org)) + '?' + q.join('&');
    var f = document.createElement('iframe');
    f.src = src; f.id = id; f.title = ev ? 'Get tickets' : page ? 'Organization page' : 'Upcoming events';
    f.loading = 'lazy'; f.style.cssText = 'width:100%;border:0;display:block;min-height:120px;background:transparent;overflow:hidden';
    f.setAttribute('scrolling', 'no'); f.setAttribute('allowtransparency', 'true');
    el.innerHTML = ''; el.appendChild(f);
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== BASE || !e.data || !e.data.tapinEmbed) return;
    var f = document.getElementById(e.data.frame);
    if (f && e.data.height) f.style.height = Math.ceil(e.data.height) + 'px';
  });
  function run() { var els = document.querySelectorAll('.tapin-events'); for (var i = 0; i < els.length; i++) mount(els[i]); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
