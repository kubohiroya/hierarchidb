import{h as w,r as g}from"./vendor-react-7oaEzvnZ.js";import{a as U,g as E,c as N,b as n}from"./createTheme-Bg71Hmd1.js";import{u as F,s as k,c as z,m as $,b as A,g as D,k as I}from"./Typography-BJbWWoMo.js";import{j as d}from"./jsx-runtime-tmbUWu7A.js";let S=0;function G(e){const[r,s]=g.useState(e),a=e||r;return g.useEffect(()=>{r==null&&(S+=1,s(`mui-${S}`))},[r]),a}const K={...w},b=K.useId;function Y(e){if(b!==void 0){const r=b();return e??r}return G(e)}function V(e){return U("MuiCircularProgress",e)}E("MuiCircularProgress",["root","determinate","indeterminate","colorPrimary","colorSecondary","svg","circle","circleDeterminate","circleIndeterminate","circleDisableShrink"]);const t=44,h=I`
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
`,y=I`
  0% {
    stroke-dasharray: 1px, 200px;
    stroke-dashoffset: 0;
  }

  50% {
    stroke-dasharray: 100px, 200px;
    stroke-dashoffset: -15px;
  }

  100% {
    stroke-dasharray: 1px, 200px;
    stroke-dashoffset: -126px;
  }
`,B=typeof h!="string"?D`
        animation: ${h} 1.4s linear infinite;
      `:null,T=typeof y!="string"?D`
        animation: ${y} 1.4s ease-in-out infinite;
      `:null,W=e=>{const{classes:r,variant:s,color:a,disableShrink:c}=e,l={root:["root",s,`color${n(a)}`],svg:["svg"],circle:["circle",`circle${n(s)}`,c&&"circleDisableShrink"]};return z(l,V,r)},Z=k("span",{name:"MuiCircularProgress",slot:"Root",overridesResolver:(e,r)=>{const{ownerState:s}=e;return[r.root,r[s.variant],r[`color${n(s.color)}`]]}})($(({theme:e})=>({display:"inline-block",variants:[{props:{variant:"determinate"},style:{transition:e.transitions.create("transform")}},{props:{variant:"indeterminate"},style:B||{animation:`${h} 1.4s linear infinite`}},...Object.entries(e.palette).filter(A()).map(([r])=>({props:{color:r},style:{color:(e.vars||e).palette[r].main}}))]}))),q=k("svg",{name:"MuiCircularProgress",slot:"Svg"})({display:"block"}),H=k("circle",{name:"MuiCircularProgress",slot:"Circle",overridesResolver:(e,r)=>{const{ownerState:s}=e;return[r.circle,r[`circle${n(s.variant)}`],s.disableShrink&&r.circleDisableShrink]}})($(({theme:e})=>({stroke:"currentColor",variants:[{props:{variant:"determinate"},style:{transition:e.transitions.create("stroke-dashoffset")}},{props:{variant:"indeterminate"},style:{strokeDasharray:"80px, 200px",strokeDashoffset:0}},{props:({ownerState:r})=>r.variant==="indeterminate"&&!r.disableShrink,style:T||{animation:`${y} 1.4s ease-in-out infinite`}}]}))),_=g.forwardRef(function(r,s){const a=F({props:r,name:"MuiCircularProgress"}),{className:c,color:l="primary",disableShrink:R=!1,size:u=40,style:M,thickness:o=3.6,value:m=0,variant:v="indeterminate",...j}=a,i={...a,color:l,disableShrink:R,size:u,thickness:o,value:m,variant:v},f=W(i),p={},x={},C={};if(v==="determinate"){const P=2*Math.PI*((t-o)/2);p.strokeDasharray=P.toFixed(3),C["aria-valuenow"]=Math.round(m),p.strokeDashoffset=`${((100-m)/100*P).toFixed(3)}px`,x.transform="rotate(-90deg)"}return d.jsx(Z,{className:N(f.root,c),style:{width:u,height:u,...x,...M},ownerState:i,ref:s,role:"progressbar",...C,...j,children:d.jsx(q,{className:f.svg,ownerState:i,viewBox:`${t/2} ${t/2} ${t} ${t}`,children:d.jsx(H,{className:f.circle,style:p,ownerState:i,cx:t,cy:t,r:(t-o)/2,fill:"none",strokeWidth:o})})})});export{_ as C,Y as u};
