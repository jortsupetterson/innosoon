// ./SERVER/Gateway

const hostRoots = {
	'template.dev':      '/template.dev',
	'innosoon.online':'/innosoon.online',
	'jori.dev':          '/jori.dev',
	'paskahousu.online': '/paskahousu.online',
	'kilpailuta.online': '/kilpailuta.online',
  };
  
  const apiRoutes = {
	'/message': async (request, env) => {
	  const { default: handler } = await import('./Mail/message.js');
	  return handler(request, env);
	},
	'/random': async (request, env) => {
	  const { default: handler } = await import('./Auth/random.js');
	  return handler(request, env);
	},
  };
  
  const pageKeywords = new Set(['Pages','Blog','Docs']);
  
  class NonceInjector {
	constructor(nonce) { this.nonce = nonce }
	element(el) { el.setAttribute('nonce', this.nonce) }
  }
  
  export default {
	async fetch(request, env) {
	  const url = new URL(request.url);
  
	  const apiHandler = apiRoutes[url.pathname];
	  if (apiHandler) {
		const response = await apiHandler(request, env);
		return attachStdHeaders(response, request, {});
	  }
  
	  const root = hostRoots[url.hostname] || '/';
	  let pathname = url.pathname;
	  const slashPos = pathname.indexOf('/',1);
	  const key = slashPos < 0
		? pathname.slice(1)
		: pathname.slice(1, slashPos);
	  if (pageKeywords.has(key)) {
		const rest = slashPos < 0 ? '' : pathname.slice(slashPos);
		pathname = `/${key}${rest}`;
	  }
  
	  const candidates = [];
	  if (!pathname.includes('.') && !pathname.endsWith('/')) candidates.push(`${pathname}.html`);
	  if (pathname.endsWith('/')) candidates.push(`${pathname}index.html`);
	  candidates.push(pathname);
  
	  const assetUrl = new URL(request.url);
	  let response;
	  for (const c of candidates) {
		assetUrl.pathname = `${root}${c}`;
		const r = await env.ASSETS.fetch(assetUrl, request);
		if (r.status < 400) { response = r; break }
	  }
	  if (!response) return attachStdHeaders(new Response('Not Found', { status: 404 }), request, {});
  
	  const ct = response.headers.get('Content-Type') || '';
	  if (ct.includes('text/html')) {
		const bytes = crypto.getRandomValues(new Uint8Array(16));
		const nonce = Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
		const csp = [
		  `default-src 'self' https: blob:`,
		  `frame-src   'self' https: blob:`,
		  `media-src   'self' data: https:`,
		  `script-src  'self' 'nonce-${nonce}' https: blob:`,
		  `style-src   'self' 'nonce-${nonce}' https:`,
		  `img-src     'self' data: https:`,
		  `font-src    'self' https:`,
		  `object-src  'none'`,
		  `base-uri    'self'`
		].join('; ');
		const rewritten = new HTMLRewriter()
		  .on('script', new NonceInjector(nonce))
		  .on('style', new NonceInjector(nonce))
		  .transform(response);
		const r2 = new Response(rewritten.body, { status: rewritten.status, headers: rewritten.headers });
		return attachStdHeaders(r2, request, { 'Content-Security-Policy': csp });
	  }
  
	  return attachStdHeaders(response, request, {});
	}
  };
  
  function attachStdHeaders(response, request, extra) {
	const headers = new Headers(response.headers);
	const origin = request.headers.get('Origin');
	const allowed = new Set(Object.keys(hostRoots));
	if (origin) try {
	  const { hostname } = new URL(origin);
	  if (allowed.has(hostname)) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.set('Access-Control-Allow-Credentials', 'true');
	  }
	} catch {}
	headers.set('X-Robots-Tag','noindex');
	headers.set('X-UA-Compatible','IE=edge');
	headers.set('X-Content-Type-Options','nosniff');
	headers.set('Referrer-Policy','strict-origin-when-cross-origin');
	headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains; preload');
	headers.set('Cache-Control','public, max-age=31536000');
	headers.set('X-Page-Rule','Cache Everything');
	headers.set('X-Failover','Automatic');
	headers.set('X-Frame-Options','DENY');
	headers.set('Cross-Origin-Opener-Policy','same-origin');
	headers.set('Cross-Origin-Embedder-Policy','require-corp');
	if (extra['Content-Security-Policy']) headers.set('Content-Security-Policy', extra['Content-Security-Policy']);
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  