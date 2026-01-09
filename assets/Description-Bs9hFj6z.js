import{s as e}from"./rolldown-runtime-CbIIB0ob.js";import{a as t,i as n}from"./vendor-react-7Qv6hoHe.js";import{Ea as r,Ki as i,Qi as a,Ta as o,Wi as s,_a as c,ga as l,ia as u,qi as d,va as f}from"./index.js";function p(e){return String(e).match(/[\d.\-+]*\s*(.*)/)[1]||``}function m(e){return parseFloat(e)}function h(e){return c(`MuiSkeleton`,e)}l(`MuiSkeleton`,[`root`,`text`,`rectangular`,`rounded`,`circular`,`pulse`,`wave`,`withChildren`,`fitContent`,`heightAuto`]);var g=e(t()),_=e(n()),v=e=>{let{classes:t,variant:n,animation:r,hasChildren:i,width:a,height:o}=e;return u({root:[`root`,n,r,i&&`withChildren`,i&&!a&&`fitContent`,i&&!o&&`heightAuto`]},h,t)},y=r`
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }

  100% {
    opacity: 1;
  }
`,b=r`
  0% {
    transform: translateX(-100%);
  }

  50% {
    /* +0.5s of delay between each loop */
    transform: translateX(100%);
  }

  100% {
    transform: translateX(100%);
  }
`,x=typeof y==`string`?null:o`
        animation: ${y} 2s ease-in-out 0.5s infinite;
      `,S=typeof b==`string`?null:o`
        &::after {
          animation: ${b} 2s linear 0.5s infinite;
        }
      `,C=a(`span`,{name:`MuiSkeleton`,slot:`Root`,overridesResolver:(e,t)=>{let{ownerState:n}=e;return[t.root,t[n.variant],n.animation!==!1&&t[n.animation],n.hasChildren&&t.withChildren,n.hasChildren&&!n.width&&t.fitContent,n.hasChildren&&!n.height&&t.heightAuto]}})(d(({theme:e})=>{let t=p(e.shape.borderRadius)||`px`,n=m(e.shape.borderRadius);return{display:`block`,backgroundColor:e.vars?e.vars.palette.Skeleton.bg:e.alpha(e.palette.text.primary,e.palette.mode===`light`?.11:.13),height:`1.2em`,variants:[{props:{variant:`text`},style:{marginTop:0,marginBottom:0,height:`auto`,transformOrigin:`0 55%`,transform:`scale(1, 0.60)`,borderRadius:`${n}${t}/${Math.round(n/.6*10)/10}${t}`,"&:empty:before":{content:`"\\00a0"`}}},{props:{variant:`circular`},style:{borderRadius:`50%`}},{props:{variant:`rounded`},style:{borderRadius:(e.vars||e).shape.borderRadius}},{props:({ownerState:e})=>e.hasChildren,style:{"& > *":{visibility:`hidden`}}},{props:({ownerState:e})=>e.hasChildren&&!e.width,style:{maxWidth:`fit-content`}},{props:({ownerState:e})=>e.hasChildren&&!e.height,style:{height:`auto`}},{props:{animation:`pulse`},style:x||{animation:`${y} 2s ease-in-out 0.5s infinite`}},{props:{animation:`wave`},style:{position:`relative`,overflow:`hidden`,WebkitMaskImage:`-webkit-radial-gradient(white, black)`,"&::after":{background:`linear-gradient(
                90deg,
                transparent,
                ${(e.vars||e).palette.action.hover},
                transparent
              )`,content:`""`,position:`absolute`,transform:`translateX(-100%)`,bottom:0,left:0,right:0,top:0}}},{props:{animation:`wave`},style:S||{"&::after":{animation:`${b} 2s linear 0.5s infinite`}}}]}})),w=g.forwardRef(function(e,t){let n=i({props:e,name:`MuiSkeleton`}),{animation:r=`pulse`,className:a,component:o=`span`,height:s,style:c,variant:l=`text`,width:u,...d}=n,p={...n,animation:r,component:o,variant:l,hasChildren:!!d.children};return(0,_.jsx)(C,{as:o,ref:t,className:f(v(p).root,a),ownerState:p,...d,style:{width:u,height:s,...c}})}),T=s((0,_.jsx)(`path`,{d:`M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8zm2 16H8v-2h8zm0-4H8v-2h8zm-3-5V3.5L18.5 9z`}),`Description`);export{w as n,T as t};