// Offline support for the installed home-screen app.
// Service workers need http(s); opening index.html from disk just skips this.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(function (err) { console.warn('service worker:', err); });
}
