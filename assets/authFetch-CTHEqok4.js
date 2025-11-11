import{A as h}from"../worker.js";async function u(t,e){return(await h.getSingleton()).fetchWithAuth(t,e,{pluginType:"shape"})}export{u as authFetch};
