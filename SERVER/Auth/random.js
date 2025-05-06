// SERVER/api/random.js
export default async function randomHandler(request, env) {
    return new Response(crypto.randomUUID(), { status: 200 });
  }
  