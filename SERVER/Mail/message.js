// SERVER/api/message.js
export default async function messageHandler(request, env) {
  return new Response('Hello, World!', { status: 200 });
}
