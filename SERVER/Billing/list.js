// SERVER/api/users/list.js
export default async function usersListHandler(request, env) {
    const users = [{id:1,name:'Jori'}, {id:2,name:'Sampo'}];
    return new Response(JSON.stringify(users), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }