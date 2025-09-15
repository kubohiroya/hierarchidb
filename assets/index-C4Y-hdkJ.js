var N=Object.defineProperty;var O=(e,r,t)=>r in e?N(e,r,{enumerable:!0,configurable:!0,writable:!0,value:t}):e[r]=t;var g=(e,r,t)=>O(e,typeof r!="symbol"?r+"":r,t);import{r as E}from"./vendor-react-7oaEzvnZ.js";import{a as S,g as z,c as B,b as n}from"./createTheme-Bg71Hmd1.js";import{u as j}from"./List-BLbuMSz8.js";import{u as q,s as y,c as D,m as k,b as h,g as L,k as x}from"./Typography-BJbWWoMo.js";import{j as v}from"./jsx-runtime-tmbUWu7A.js";function M(e){return S("MuiLinearProgress",e)}z("MuiLinearProgress",["root","colorPrimary","colorSecondary","determinate","indeterminate","buffer","query","dashed","dashedColorPrimary","dashedColorSecondary","bar","bar1","bar2","barColorPrimary","barColorSecondary","bar1Indeterminate","bar1Determinate","bar1Buffer","bar2Indeterminate","bar2Buffer"]);const P=4,w=x`
  0% {
    left: -35%;
    right: 100%;
  }

  60% {
    left: 100%;
    right: -90%;
  }

  100% {
    left: 100%;
    right: -90%;
  }
`,W=typeof w!="string"?L`
        animation: ${w} 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
      `:null,I=x`
  0% {
    left: -200%;
    right: 100%;
  }

  60% {
    left: 107%;
    right: -8%;
  }

  100% {
    left: 107%;
    right: -8%;
  }
`,_=typeof I!="string"?L`
        animation: ${I} 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite;
      `:null,$=x`
  0% {
    opacity: 1;
    background-position: 0 -23px;
  }

  60% {
    opacity: 0;
    background-position: 0 -23px;
  }

  100% {
    opacity: 1;
    background-position: -200px -23px;
  }
`,H=typeof $!="string"?L`
        animation: ${$} 3s infinite linear;
      `:null,A=e=>{const{classes:r,variant:t,color:a}=e,o={root:["root",`color${n(a)}`,t],dashed:["dashed",`dashedColor${n(a)}`],bar1:["bar","bar1",`barColor${n(a)}`,(t==="indeterminate"||t==="query")&&"bar1Indeterminate",t==="determinate"&&"bar1Determinate",t==="buffer"&&"bar1Buffer"],bar2:["bar","bar2",t!=="buffer"&&`barColor${n(a)}`,t==="buffer"&&`color${n(a)}`,(t==="indeterminate"||t==="query")&&"bar2Indeterminate",t==="buffer"&&"bar2Buffer"]};return D(o,M,r)},R=(e,r)=>e.vars?e.vars.palette.LinearProgress[`${r}Bg`]:e.palette.mode==="light"?e.lighten(e.palette[r].main,.62):e.darken(e.palette[r].main,.5),U=y("span",{name:"MuiLinearProgress",slot:"Root",overridesResolver:(e,r)=>{const{ownerState:t}=e;return[r.root,r[`color${n(t.color)}`],r[t.variant]]}})(k(({theme:e})=>({position:"relative",overflow:"hidden",display:"block",height:4,zIndex:0,"@media print":{colorAdjust:"exact"},variants:[...Object.entries(e.palette).filter(h()).map(([r])=>({props:{color:r},style:{backgroundColor:R(e,r)}})),{props:({ownerState:r})=>r.color==="inherit"&&r.variant!=="buffer",style:{"&::before":{content:'""',position:"absolute",left:0,top:0,right:0,bottom:0,backgroundColor:"currentColor",opacity:.3}}},{props:{variant:"buffer"},style:{backgroundColor:"transparent"}},{props:{variant:"query"},style:{transform:"rotate(180deg)"}}]}))),G=y("span",{name:"MuiLinearProgress",slot:"Dashed",overridesResolver:(e,r)=>{const{ownerState:t}=e;return[r.dashed,r[`dashedColor${n(t.color)}`]]}})(k(({theme:e})=>({position:"absolute",marginTop:0,height:"100%",width:"100%",backgroundSize:"10px 10px",backgroundPosition:"0 -23px",variants:[{props:{color:"inherit"},style:{opacity:.3,backgroundImage:"radial-gradient(currentColor 0%, currentColor 16%, transparent 42%)"}},...Object.entries(e.palette).filter(h()).map(([r])=>{const t=R(e,r);return{props:{color:r},style:{backgroundImage:`radial-gradient(${t} 0%, ${t} 16%, transparent 42%)`}}})]})),H||{animation:`${$} 3s infinite linear`}),K=y("span",{name:"MuiLinearProgress",slot:"Bar1",overridesResolver:(e,r)=>{const{ownerState:t}=e;return[r.bar,r.bar1,r[`barColor${n(t.color)}`],(t.variant==="indeterminate"||t.variant==="query")&&r.bar1Indeterminate,t.variant==="determinate"&&r.bar1Determinate,t.variant==="buffer"&&r.bar1Buffer]}})(k(({theme:e})=>({width:"100%",position:"absolute",left:0,bottom:0,top:0,transition:"transform 0.2s linear",transformOrigin:"left",variants:[{props:{color:"inherit"},style:{backgroundColor:"currentColor"}},...Object.entries(e.palette).filter(h()).map(([r])=>({props:{color:r},style:{backgroundColor:(e.vars||e).palette[r].main}})),{props:{variant:"determinate"},style:{transition:`transform .${P}s linear`}},{props:{variant:"buffer"},style:{zIndex:1,transition:`transform .${P}s linear`}},{props:({ownerState:r})=>r.variant==="indeterminate"||r.variant==="query",style:{width:"auto"}},{props:({ownerState:r})=>r.variant==="indeterminate"||r.variant==="query",style:W||{animation:`${w} 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite`}}]}))),F=y("span",{name:"MuiLinearProgress",slot:"Bar2",overridesResolver:(e,r)=>{const{ownerState:t}=e;return[r.bar,r.bar2,r[`barColor${n(t.color)}`],(t.variant==="indeterminate"||t.variant==="query")&&r.bar2Indeterminate,t.variant==="buffer"&&r.bar2Buffer]}})(k(({theme:e})=>({width:"100%",position:"absolute",left:0,bottom:0,top:0,transition:"transform 0.2s linear",transformOrigin:"left",variants:[...Object.entries(e.palette).filter(h()).map(([r])=>({props:{color:r},style:{"--LinearProgressBar2-barColor":(e.vars||e).palette[r].main}})),{props:({ownerState:r})=>r.variant!=="buffer"&&r.color!=="inherit",style:{backgroundColor:"var(--LinearProgressBar2-barColor, currentColor)"}},{props:({ownerState:r})=>r.variant!=="buffer"&&r.color==="inherit",style:{backgroundColor:"currentColor"}},{props:{color:"inherit"},style:{opacity:.3}},...Object.entries(e.palette).filter(h()).map(([r])=>({props:{color:r,variant:"buffer"},style:{backgroundColor:R(e,r),transition:`transform .${P}s linear`}})),{props:({ownerState:r})=>r.variant==="indeterminate"||r.variant==="query",style:{width:"auto"}},{props:({ownerState:r})=>r.variant==="indeterminate"||r.variant==="query",style:_||{animation:`${I} 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) 1.15s infinite`}}]}))),ar=E.forwardRef(function(r,t){const a=q({props:r,name:"MuiLinearProgress"}),{className:o,color:C="primary",value:d,valueBuffer:s,variant:l="indeterminate",...m}=a,i={...a,color:C,variant:l},u=A(i),b=j(),c={},p={bar1:{},bar2:{}};if((l==="determinate"||l==="buffer")&&d!==void 0){c["aria-valuenow"]=Math.round(d),c["aria-valuemin"]=0,c["aria-valuemax"]=100;let f=d-100;b&&(f=-f),p.bar1.transform=`translateX(${f}%)`}if(l==="buffer"&&s!==void 0){let f=(s||0)-100;b&&(f=-f),p.bar2.transform=`translateX(${f}%)`}return v.jsxs(U,{className:B(u.root,o),ownerState:i,role:"progressbar",...c,ref:t,...m,children:[l==="buffer"?v.jsx(G,{className:u.dashed,ownerState:i}):null,v.jsx(K,{className:u.bar1,ownerState:i,style:p.bar1}),l==="determinate"?null:v.jsx(F,{className:u.bar2,ownerState:i,style:p.bar2})]})});var X=class{constructor(){g(this,"worker",null);g(this,"initPromise",null);g(this,"messageHandler",null);g(this,"debug",!1)}waitForInitialization(e){const{worker:r,timeout:t=3e4,debug:a=!1}=e;if(this.initPromise)return this.initPromise;this.worker=r,this.debug=a;const o=Date.now();return this.initPromise=new Promise((C,d)=>{let s=null;if(s=window.setTimeout(()=>{this.cleanup();const m=new Error(`Worker initialization timeout after ${t}ms`);d({success:!1,error:m,duration:Date.now()-o})},t),this.messageHandler=m=>{var u,b,c;const i=m.data;switch(this.debug&&console.log("[WorkerInitChannel] Received message:",i),i.type){case"INIT_COMPLETE":s&&clearTimeout(s),this.cleanup(),C({success:!0,duration:Date.now()-o});break;case"INIT_ERROR":s&&clearTimeout(s),this.cleanup();const p=new Error(((u=i.payload)==null?void 0:u.error)||"Worker initialization failed");d({success:!1,error:p,duration:Date.now()-o});break;case"INIT_PROGRESS":this.debug&&console.log(`[WorkerInitChannel] Progress: ${(b=i.payload)==null?void 0:b.progress}% - ${(c=i.payload)==null?void 0:c.message}`);break;case"PING_RESPONSE":this.debug&&console.log("[WorkerInitChannel] Ping response received");break}},!this.worker)throw new Error("Worker is not initialized");this.worker.addEventListener("message",this.messageHandler);const l={type:"INIT_REQUEST",timestamp:Date.now()};this.worker.postMessage(l),this.debug&&console.log("[WorkerInitChannel] Sent initialization request")}),this.initPromise}async ping(){return this.worker?new Promise(e=>{const r=setTimeout(()=>{e(!1)},1e3),t=a=>{var o;a.data.type==="PING_RESPONSE"&&(clearTimeout(r),(o=this.worker)==null||o.removeEventListener("message",t),e(!0))};if(this.worker){this.worker.addEventListener("message",t);const a={type:"PING"};this.worker.postMessage(a)}else e(!1)}):!1}cleanup(){this.worker&&this.messageHandler&&this.worker.removeEventListener("message",this.messageHandler),this.messageHandler=null,this.initPromise=null}dispose(){this.cleanup(),this.worker=null}};E.createContext(null);var T=null;function Q(e){T=e}function V(){return T}const ir=Object.freeze(Object.defineProperty({__proto__:null,WorkerInitializationChannel:X,getWorkerClientHook:V,registerWorkerClientHook:Q},Symbol.toStringTag,{value:"Module"}));export{ar as L,X as W,V as g,ir as i,Q as r};
