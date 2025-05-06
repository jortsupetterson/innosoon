// ./SERVER/Gateway.js

// 1) Domain → juurikansio
const hostRoots = {
	'template.dev':      '/template.dev',
	'jori.dev': '/jori.dev',
	'paskahousu.online': '/paskahousu.online',
	'kilpailuta.online': '/kilpailuta.online',
  };
  
  // 2) Staattiset API‐reitit
  const apiRoutes = {
	'/message': () => new Response('Hello, World!'),
	'/random':  () => new Response(crypto.randomUUID()),
  };
  
  // 3) Avainsanat ensimäiseen URL‐segmenttiin (esim. Pages/)
  const pageKeywords = new Set(['Pages','Blog','Docs']);
  
  // 4) Nonce‐injektoija <script> ja <style> tageille
  class NonceInjector {
	constructor(nonce) { this.nonce = nonce }
	element(el)   { el.setAttribute('nonce', this.nonce) }
  }
  
  export default {
	async fetch(request, env) {
	  let response;
	  const url = new URL(request.url);
  
	  // A) API‐reitit ensin
	  const apiHandler = apiRoutes[url.pathname];
	  if (apiHandler) {
		response = apiHandler(request, env);
		return attachStdHeaders(response, request, {});
	  }
  
	  // B) Staattisten assettien polku domain‐kohtaisesti
	  const root = hostRoots[url.hostname] || '/';
	  let pathname = url.pathname;
  
	  // C) Avainsana‐kansio (Pages, Blog, Docs)
	  const slashPos = pathname.indexOf('/', 1);
	  const keyword  = slashPos < 0
		? pathname.slice(1)
		: pathname.slice(1, slashPos);
	  if (pageKeywords.has(keyword)) {
		const rest = slashPos < 0 ? '' : pathname.slice(slashPos);
		pathname = `/${keyword}${rest}`;
	  }
  
	  // D) Clean URL -fallbackit (.html / index.html)
	  const candidates = [];
	  if (!pathname.includes('.') && !pathname.endsWith('/')) {
		candidates.push(`${pathname}.html`);
	  }
	  if (pathname.endsWith('/')) {
		candidates.push(`${pathname}index.html`);
	  }
	  candidates.push(pathname);
  
	  // E) Hae ensimmäinen löytyvä asset
	  const assetUrl = new URL(request.url);
	  for (const candidate of candidates) {
		assetUrl.pathname = `${root}${candidate}`;
		const r = await env.ASSETS.fetch(assetUrl, request);
		if (r.status < 400) {
		  response = r;
		  break;
		}
	  }
	  if (!response || response.status >= 400) {
		response = new Response('Not Found', { status: 404 });
		return attachStdHeaders(response, request, {});
	  }
  
	  // F) Jos HTML, lisää nonce + CSP-header
	  const ct = response.headers.get('Content-Type') || '';
	  if (ct.includes('text/html')) {
		const bytes = crypto.getRandomValues(new Uint8Array(16));
		const nonce = Array.from(bytes)
		  .map(b => b.toString(16).padStart(2,'0'))
		  .join('');
  
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
		  .on('style',  new NonceInjector(nonce))
		  .transform(response);
  
		response = new Response(rewritten.body, {
		  status:  rewritten.status,
		  headers: rewritten.headers
		});
		return attachStdHeaders(response, request, { 'Content-Security-Policy': csp });
	  }
  
	  // G) Muut assetit
	  return attachStdHeaders(response, request, {});
	}
  };
  
  /**
   * Liittää jokaisen Response‐olion headerit:
   * CORS, robotstagi, HSTS, CSP, COOP, XFO, jne.
   */
  function attachStdHeaders(response, request, extraHeaders) {
	const headers = new Headers(response.headers);
	const origin = request.headers.get('Origin');
	const allowed = new Set(Object.keys(hostRoots));
  
	// 1) CORS vain hostRoots‐listasta
	if (origin) {
	  try {
		const { hostname } = new URL(origin);
		if (allowed.has(hostname)) {
		  headers.set('Access-Control-Allow-Origin', origin);
		  headers.set('Access-Control-Allow-Credentials', 'true');
		}
	  } catch {}
	}
  
	// 2) Security/meta‐tason headerit
	headers.set('X-Robots-Tag', 'noindex');
	headers.set('X-UA-Compatible', 'IE=edge');
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
	// 3) HSTS
	headers.set('Strict-Transport-Security',
	  'max-age=31536000; includeSubDomains; preload');
  
	// 4) Caching & page rules
	headers.set('Cache-Control', 'public, max-age=31536000');
	headers.set('X-Page-Rule', 'Cache Everything');
	headers.set('X-Failover', 'Automatic');
  
	// 5) Clickjacking-suojaus
	headers.set('X-Frame-Options', 'DENY');
  
	// 6) COOP & COEP
	headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  
	// 7) Dynaaminen CSP (jos annettu)
	if (extraHeaders['Content-Security-Policy']) {
	  const baseCSP = extraHeaders['Content-Security-Policy'];
	  headers.set('Content-Security-Policy', baseCSP);
	}
  
	return new Response(response.body, {
	  status:     response.status,
	  statusText: response.statusText,
	  headers
	});
  }
  