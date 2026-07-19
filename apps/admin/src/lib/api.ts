let csrfToken=''
export function setCsrf(token:string){csrfToken=token}
export async function api<T=any>(path:string,init:RequestInit={}){
  const headers=new Headers(init.headers); if(init.body&&!(init.body instanceof FormData))headers.set('Content-Type','application/json'); if(csrfToken&&!['GET','HEAD'].includes(init.method??'GET'))headers.set('x-csrf-token',csrfToken)
  const res=await fetch(`/api${path}`,{...init,headers,credentials:'include'}); if(res.status===204)return undefined as T; const value=await res.json(); if(!res.ok)throw new Error(value.error?.message??'Request failed'); if(value.csrfToken)setCsrf(value.csrfToken); return value as T
}
