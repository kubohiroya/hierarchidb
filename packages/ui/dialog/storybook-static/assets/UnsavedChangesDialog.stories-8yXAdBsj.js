import{c as qe,j as r,g as E,b as _,u as Y,d as Ve,e as me,f as D,h as K,s as U,i,k as q,m as We,l as X,n as ge,T as A,t as ye,a as H}from"./Save-DNwg0ee0.js";import{U as Je}from"./UnsavedChangesDialog-DLzuhhD8.js";import{r as p}from"./iframe-DFl9RHSL.js";import"./index-Di1Mf8tn.js";import"./preload-helper-C1FmrZbK.js";function Qe(e,o){var t,a,n;return p.isValidElement(e)&&o.indexOf(e.type.muiName??((n=(a=(t=e.type)==null?void 0:t._payload)==null?void 0:a.value)==null?void 0:n.muiName))!==-1}const Xe=qe(r.jsx("path",{d:"M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"}));function Ze(e){return _("MuiChip",e)}const s=E("MuiChip",["root","sizeSmall","sizeMedium","colorDefault","colorError","colorInfo","colorPrimary","colorSecondary","colorSuccess","colorWarning","disabled","clickable","clickableColorPrimary","clickableColorSecondary","deletable","deletableColorPrimary","deletableColorSecondary","outlined","filled","outlinedPrimary","outlinedSecondary","filledPrimary","filledSecondary","avatar","avatarSmall","avatarMedium","avatarColorPrimary","avatarColorSecondary","icon","iconSmall","iconMedium","iconColorPrimary","iconColorSecondary","label","labelSmall","labelMedium","deleteIcon","deleteIconSmall","deleteIconMedium","deleteIconColorPrimary","deleteIconColorSecondary","deleteIconOutlinedColorPrimary","deleteIconOutlinedColorSecondary","deleteIconFilledColorPrimary","deleteIconFilledColorSecondary","focusVisible"]),eo=e=>{const{classes:o,disabled:t,size:a,color:n,iconColor:m,onDelete:d,clickable:l,variant:u}=e,v={root:["root",u,t&&"disabled",`size${i(a)}`,`color${i(n)}`,l&&"clickable",l&&`clickableColor${i(n)}`,d&&"deletable",d&&`deletableColor${i(n)}`,`${u}${i(n)}`],label:["label",`label${i(a)}`],avatar:["avatar",`avatar${i(a)}`,`avatarColor${i(n)}`],icon:["icon",`icon${i(a)}`,`iconColor${i(m)}`],deleteIcon:["deleteIcon",`deleteIcon${i(a)}`,`deleteIconColor${i(n)}`,`deleteIcon${i(u)}Color${i(n)}`]};return q(v,Ze,o)},oo=U("div",{name:"MuiChip",slot:"Root",overridesResolver:(e,o)=>{const{ownerState:t}=e,{color:a,iconColor:n,clickable:m,onDelete:d,size:l,variant:u}=t;return[{[`& .${s.avatar}`]:o.avatar},{[`& .${s.avatar}`]:o[`avatar${i(l)}`]},{[`& .${s.avatar}`]:o[`avatarColor${i(a)}`]},{[`& .${s.icon}`]:o.icon},{[`& .${s.icon}`]:o[`icon${i(l)}`]},{[`& .${s.icon}`]:o[`iconColor${i(n)}`]},{[`& .${s.deleteIcon}`]:o.deleteIcon},{[`& .${s.deleteIcon}`]:o[`deleteIcon${i(l)}`]},{[`& .${s.deleteIcon}`]:o[`deleteIconColor${i(a)}`]},{[`& .${s.deleteIcon}`]:o[`deleteIcon${i(u)}Color${i(a)}`]},o.root,o[`size${i(l)}`],o[`color${i(a)}`],m&&o.clickable,m&&a!=="default"&&o[`clickableColor${i(a)})`],d&&o.deletable,d&&a!=="default"&&o[`deletableColor${i(a)}`],o[u],o[`${u}${i(a)}`]]}})(We(({theme:e})=>{const o=e.palette.mode==="light"?e.palette.grey[700]:e.palette.grey[300];return{maxWidth:"100%",fontFamily:e.typography.fontFamily,fontSize:e.typography.pxToRem(13),display:"inline-flex",alignItems:"center",justifyContent:"center",height:32,lineHeight:1.5,color:(e.vars||e).palette.text.primary,backgroundColor:(e.vars||e).palette.action.selected,borderRadius:32/2,whiteSpace:"nowrap",transition:e.transitions.create(["background-color","box-shadow"]),cursor:"unset",outline:0,textDecoration:"none",border:0,padding:0,verticalAlign:"middle",boxSizing:"border-box",[`&.${s.disabled}`]:{opacity:(e.vars||e).palette.action.disabledOpacity,pointerEvents:"none"},[`& .${s.avatar}`]:{marginLeft:5,marginRight:-6,width:24,height:24,color:e.vars?e.vars.palette.Chip.defaultAvatarColor:o,fontSize:e.typography.pxToRem(12)},[`& .${s.avatarColorPrimary}`]:{color:(e.vars||e).palette.primary.contrastText,backgroundColor:(e.vars||e).palette.primary.dark},[`& .${s.avatarColorSecondary}`]:{color:(e.vars||e).palette.secondary.contrastText,backgroundColor:(e.vars||e).palette.secondary.dark},[`& .${s.avatarSmall}`]:{marginLeft:4,marginRight:-4,width:18,height:18,fontSize:e.typography.pxToRem(10)},[`& .${s.icon}`]:{marginLeft:5,marginRight:-6},[`& .${s.deleteIcon}`]:{WebkitTapHighlightColor:"transparent",color:e.alpha((e.vars||e).palette.text.primary,.26),fontSize:22,cursor:"pointer",margin:"0 5px 0 -6px","&:hover":{color:e.alpha((e.vars||e).palette.text.primary,.4)}},variants:[{props:{size:"small"},style:{height:24,[`& .${s.icon}`]:{fontSize:18,marginLeft:4,marginRight:-4},[`& .${s.deleteIcon}`]:{fontSize:16,marginRight:4,marginLeft:-4}}},...Object.entries(e.palette).filter(X(["contrastText"])).map(([t])=>({props:{color:t},style:{backgroundColor:(e.vars||e).palette[t].main,color:(e.vars||e).palette[t].contrastText,[`& .${s.deleteIcon}`]:{color:e.alpha((e.vars||e).palette[t].contrastText,.7),"&:hover, &:active":{color:(e.vars||e).palette[t].contrastText}}}})),{props:t=>t.iconColor===t.color,style:{[`& .${s.icon}`]:{color:e.vars?e.vars.palette.Chip.defaultIconColor:o}}},{props:t=>t.iconColor===t.color&&t.color!=="default",style:{[`& .${s.icon}`]:{color:"inherit"}}},{props:{onDelete:!0},style:{[`&.${s.focusVisible}`]:{backgroundColor:e.alpha((e.vars||e).palette.action.selected,`${(e.vars||e).palette.action.selectedOpacity} + ${(e.vars||e).palette.action.focusOpacity}`)}}},...Object.entries(e.palette).filter(X(["dark"])).map(([t])=>({props:{color:t,onDelete:!0},style:{[`&.${s.focusVisible}`]:{background:(e.vars||e).palette[t].dark}}})),{props:{clickable:!0},style:{userSelect:"none",WebkitTapHighlightColor:"transparent",cursor:"pointer","&:hover":{backgroundColor:e.alpha((e.vars||e).palette.action.selected,`${(e.vars||e).palette.action.selectedOpacity} + ${(e.vars||e).palette.action.hoverOpacity}`)},[`&.${s.focusVisible}`]:{backgroundColor:e.alpha((e.vars||e).palette.action.selected,`${(e.vars||e).palette.action.selectedOpacity} + ${(e.vars||e).palette.action.focusOpacity}`)},"&:active":{boxShadow:(e.vars||e).shadows[1]}}},...Object.entries(e.palette).filter(X(["dark"])).map(([t])=>({props:{color:t,clickable:!0},style:{[`&:hover, &.${s.focusVisible}`]:{backgroundColor:(e.vars||e).palette[t].dark}}})),{props:{variant:"outlined"},style:{backgroundColor:"transparent",border:e.vars?`1px solid ${e.vars.palette.Chip.defaultBorder}`:`1px solid ${e.palette.mode==="light"?e.palette.grey[400]:e.palette.grey[700]}`,[`&.${s.clickable}:hover`]:{backgroundColor:(e.vars||e).palette.action.hover},[`&.${s.focusVisible}`]:{backgroundColor:(e.vars||e).palette.action.focus},[`& .${s.avatar}`]:{marginLeft:4},[`& .${s.avatarSmall}`]:{marginLeft:2},[`& .${s.icon}`]:{marginLeft:4},[`& .${s.iconSmall}`]:{marginLeft:2},[`& .${s.deleteIcon}`]:{marginRight:5},[`& .${s.deleteIconSmall}`]:{marginRight:3}}},...Object.entries(e.palette).filter(X()).map(([t])=>({props:{variant:"outlined",color:t},style:{color:(e.vars||e).palette[t].main,border:`1px solid ${e.alpha((e.vars||e).palette[t].main,.7)}`,[`&.${s.clickable}:hover`]:{backgroundColor:e.alpha((e.vars||e).palette[t].main,(e.vars||e).palette.action.hoverOpacity)},[`&.${s.focusVisible}`]:{backgroundColor:e.alpha((e.vars||e).palette[t].main,(e.vars||e).palette.action.focusOpacity)},[`& .${s.deleteIcon}`]:{color:e.alpha((e.vars||e).palette[t].main,.7),"&:hover, &:active":{color:(e.vars||e).palette[t].main}}}}))]}})),to=U("span",{name:"MuiChip",slot:"Label",overridesResolver:(e,o)=>{const{ownerState:t}=e,{size:a}=t;return[o.label,o[`label${i(a)}`]]}})({overflow:"hidden",textOverflow:"ellipsis",paddingLeft:12,paddingRight:12,whiteSpace:"nowrap",variants:[{props:{variant:"outlined"},style:{paddingLeft:11,paddingRight:11}},{props:{size:"small"},style:{paddingLeft:8,paddingRight:8}},{props:{size:"small",variant:"outlined"},style:{paddingLeft:7,paddingRight:7}}]});function fe(e){return e.key==="Backspace"||e.key==="Delete"}const ao=p.forwardRef(function(o,t){const a=Y({props:o,name:"MuiChip"}),{avatar:n,className:m,clickable:d,color:l="default",component:u,deleteIcon:v,disabled:I=!1,icon:b,label:P,onClick:x,onDelete:g,onKeyDown:j,onKeyUp:C,size:S="medium",variant:w="filled",tabIndex:M,skipFocusWhenDisabled:N=!1,slots:O={},slotProps:z={},...G}=a,f=p.useRef(null),V=Ve(f,t),h=c=>{c.stopPropagation(),g&&g(c)},J=c=>{c.currentTarget===c.target&&fe(c)&&c.preventDefault(),j&&j(c)},Q=c=>{c.currentTarget===c.target&&g&&fe(c)&&g(c),C&&C(c)},T=d!==!1&&x?!0:d,$=T||g?me:u||"div",L={...a,component:$,disabled:I,size:S,color:l,iconColor:p.isValidElement(b)&&b.props.color||l,onDelete:!!g,clickable:T,variant:w},y=eo(L),Ge=$===me?{component:u||"div",focusVisibleClassName:y.focusVisible,...g&&{disableRipple:!0}}:{};let ce=null;g&&(ce=v&&p.isValidElement(v)?p.cloneElement(v,{className:D(v.props.className,y.deleteIcon),onClick:h}):r.jsx(Xe,{className:y.deleteIcon,onClick:h}));let de=null;n&&p.isValidElement(n)&&(de=p.cloneElement(n,{className:D(y.avatar,n.props.className)}));let pe=null;b&&p.isValidElement(b)&&(pe=p.cloneElement(b,{className:D(y.icon,b.props.className)}));const ue={slots:O,slotProps:z},[Ke,He]=K("root",{elementType:oo,externalForwardedProps:{...ue,...G},ownerState:L,shouldForwardComponentProp:!0,ref:V,className:D(y.root,m),additionalProps:{disabled:T&&I?!0:void 0,tabIndex:N&&I?-1:M,...Ge},getSlotProps:c=>({...c,onClick:k=>{var R;(R=c.onClick)==null||R.call(c,k),x==null||x(k)},onKeyDown:k=>{var R;(R=c.onKeyDown)==null||R.call(c,k),J(k)},onKeyUp:k=>{var R;(R=c.onKeyUp)==null||R.call(c,k),Q(k)}})}),[_e,Ye]=K("label",{elementType:to,externalForwardedProps:ue,ownerState:L,className:y.label});return r.jsxs(Ke,{as:$,...He,children:[de||pe,r.jsx(_e,{...Ye,children:P}),ce]})}),W=p.createContext({});function ro(e){return _("MuiList",e)}E("MuiList",["root","padding","dense","subheader"]);const so=e=>{const{classes:o,disablePadding:t,dense:a,subheader:n}=e;return q({root:["root",!t&&"padding",a&&"dense",n&&"subheader"]},ro,o)},no=U("ul",{name:"MuiList",slot:"Root",overridesResolver:(e,o)=>{const{ownerState:t}=e;return[o.root,!t.disablePadding&&o.padding,t.dense&&o.dense,t.subheader&&o.subheader]}})({listStyle:"none",margin:0,padding:0,position:"relative",variants:[{props:({ownerState:e})=>!e.disablePadding,style:{paddingTop:8,paddingBottom:8}},{props:({ownerState:e})=>e.subheader,style:{paddingTop:0}}]}),le=p.forwardRef(function(o,t){const a=Y({props:o,name:"MuiList"}),{children:n,className:m,component:d="ul",dense:l=!1,disablePadding:u=!1,subheader:v,...I}=a,b=p.useMemo(()=>({dense:l}),[l]),P={...a,component:d,dense:l,disablePadding:u},x=so(P);return r.jsx(W.Provider,{value:b,children:r.jsxs(no,{as:d,className:D(x.root,m),ref:t,ownerState:P,...I,children:[v,n]})})});function io(e){return _("MuiListItem",e)}E("MuiListItem",["root","container","dense","alignItemsFlexStart","divider","gutters","padding","secondaryAction"]);const lo=E("MuiListItemButton",["root","focusVisible","dense","alignItemsFlexStart","disabled","divider","gutters","selected"]);function co(e){return _("MuiListItemSecondaryAction",e)}E("MuiListItemSecondaryAction",["root","disableGutters"]);const po=e=>{const{disableGutters:o,classes:t}=e;return q({root:["root",o&&"disableGutters"]},co,t)},uo=U("div",{name:"MuiListItemSecondaryAction",slot:"Root",overridesResolver:(e,o)=>{const{ownerState:t}=e;return[o.root,t.disableGutters&&o.disableGutters]}})({position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",variants:[{props:({ownerState:e})=>e.disableGutters,style:{right:0}}]}),Ee=p.forwardRef(function(o,t){const a=Y({props:o,name:"MuiListItemSecondaryAction"}),{className:n,...m}=a,d=p.useContext(W),l={...a,disableGutters:d.disableGutters},u=po(l);return r.jsx(uo,{className:D(u.root,n),ownerState:l,ref:t,...m})});Ee.muiName="ListItemSecondaryAction";const mo=(e,o)=>{const{ownerState:t}=e;return[o.root,t.dense&&o.dense,t.alignItems==="flex-start"&&o.alignItemsFlexStart,t.divider&&o.divider,!t.disableGutters&&o.gutters,!t.disablePadding&&o.padding,t.hasSecondaryAction&&o.secondaryAction]},go=e=>{const{alignItems:o,classes:t,dense:a,disableGutters:n,disablePadding:m,divider:d,hasSecondaryAction:l}=e;return q({root:["root",a&&"dense",!n&&"gutters",!m&&"padding",d&&"divider",o==="flex-start"&&"alignItemsFlexStart",l&&"secondaryAction"],container:["container"]},io,t)},yo=U("div",{name:"MuiListItem",slot:"Root",overridesResolver:mo})(We(({theme:e})=>({display:"flex",justifyContent:"flex-start",alignItems:"center",position:"relative",textDecoration:"none",width:"100%",boxSizing:"border-box",textAlign:"left",variants:[{props:({ownerState:o})=>!o.disablePadding,style:{paddingTop:8,paddingBottom:8}},{props:({ownerState:o})=>!o.disablePadding&&o.dense,style:{paddingTop:4,paddingBottom:4}},{props:({ownerState:o})=>!o.disablePadding&&!o.disableGutters,style:{paddingLeft:16,paddingRight:16}},{props:({ownerState:o})=>!o.disablePadding&&!!o.secondaryAction,style:{paddingRight:48}},{props:({ownerState:o})=>!!o.secondaryAction,style:{[`& > .${lo.root}`]:{paddingRight:48}}},{props:{alignItems:"flex-start"},style:{alignItems:"flex-start"}},{props:({ownerState:o})=>o.divider,style:{borderBottom:`1px solid ${(e.vars||e).palette.divider}`,backgroundClip:"padding-box"}},{props:({ownerState:o})=>o.button,style:{transition:e.transitions.create("background-color",{duration:e.transitions.duration.shortest}),"&:hover":{textDecoration:"none",backgroundColor:(e.vars||e).palette.action.hover,"@media (hover: none)":{backgroundColor:"transparent"}}}},{props:({ownerState:o})=>o.hasSecondaryAction,style:{paddingRight:48}}]}))),fo=U("li",{name:"MuiListItem",slot:"Container"})({position:"relative"}),B=p.forwardRef(function(o,t){const a=Y({props:o,name:"MuiListItem"}),{alignItems:n="center",children:m,className:d,component:l,components:u={},componentsProps:v={},ContainerComponent:I="li",ContainerProps:{className:b,...P}={},dense:x=!1,disableGutters:g=!1,disablePadding:j=!1,divider:C=!1,secondaryAction:S,slotProps:w={},slots:M={},...N}=a,O=p.useContext(W),z=p.useMemo(()=>({dense:x||O.dense||!1,alignItems:n,disableGutters:g}),[n,O.dense,x,g]),G=p.useRef(null),f=p.Children.toArray(m),V=f.length&&Qe(f[f.length-1],["ListItemSecondaryAction"]),h={...a,alignItems:n,dense:z.dense,disableGutters:g,disablePadding:j,divider:C,hasSecondaryAction:V},J=go(h),Q=Ve(G,t),T=M.root||u.Root||yo,$=w.root||v.root||{},L={className:D(J.root,$.className,d),...N};let y=l||"li";return V?(y=!L.component&&!l?"div":y,I==="li"&&(y==="li"?y="div":L.component==="li"&&(L.component="div")),r.jsx(W.Provider,{value:z,children:r.jsxs(fo,{as:I,className:D(J.container,b),ref:Q,ownerState:h,...P,children:[r.jsx(T,{...$,...!ge(T)&&{as:y,ownerState:{...h,...$.ownerState}},...L,children:f}),f.pop()]})})):r.jsx(W.Provider,{value:z,children:r.jsxs(T,{...$,as:y,ref:Q,...!ge(T)&&{ownerState:{...h,...$.ownerState}},...L,children:[f,S&&r.jsx(Ee,{children:S})]})})});function vo(e){return _("MuiListItemText",e)}const Z=E("MuiListItemText",["root","multiline","dense","inset","primary","secondary"]),bo=e=>{const{classes:o,inset:t,primary:a,secondary:n,dense:m}=e;return q({root:["root",t&&"inset",m&&"dense",a&&n&&"multiline"],primary:["primary"],secondary:["secondary"]},vo,o)},xo=U("div",{name:"MuiListItemText",slot:"Root",overridesResolver:(e,o)=>{const{ownerState:t}=e;return[{[`& .${Z.primary}`]:o.primary},{[`& .${Z.secondary}`]:o.secondary},o.root,t.inset&&o.inset,t.primary&&t.secondary&&o.multiline,t.dense&&o.dense]}})({flex:"1 1 auto",minWidth:0,marginTop:4,marginBottom:4,[`.${ye.root}:where(& .${Z.primary})`]:{display:"block"},[`.${ye.root}:where(& .${Z.secondary})`]:{display:"block"},variants:[{props:({ownerState:e})=>e.primary&&e.secondary,style:{marginTop:6,marginBottom:6}},{props:({ownerState:e})=>e.inset,style:{paddingLeft:56}}]}),F=p.forwardRef(function(o,t){const a=Y({props:o,name:"MuiListItemText"}),{children:n,className:m,disableTypography:d=!1,inset:l=!1,primary:u,primaryTypographyProps:v,secondary:I,secondaryTypographyProps:b,slots:P={},slotProps:x={},...g}=a,{dense:j}=p.useContext(W);let C=u??n,S=I;const w={...a,disableTypography:d,inset:l,primary:!!C,secondary:!!S,dense:j},M=bo(w),N={slots:P,slotProps:{primary:v,secondary:b,...x}},[O,z]=K("root",{className:D(M.root,m),elementType:xo,externalForwardedProps:{...N,...g},ownerState:w,ref:t}),[G,f]=K("primary",{className:M.primary,elementType:A,externalForwardedProps:N,ownerState:w}),[V,h]=K("secondary",{className:M.secondary,elementType:A,externalForwardedProps:N,ownerState:w});return C!=null&&C.type!==A&&!d&&(C=r.jsx(G,{variant:j?"body2":"body1",component:f!=null&&f.variant?void 0:"span",...f,children:C})),S!=null&&S.type!==A&&!d&&(S=r.jsx(V,{variant:"body2",color:"textSecondary",...h,children:S})),r.jsxs(O,{...z,children:[C,S]})}),Lo={title:"ui/legacy-dialog/UnsavedChangesDialog",component:Je,parameters:{layout:"centered",docs:{description:{component:"未保存の変更を破棄する際の確認ダイアログ。保存、破棄、キャンセルのオプションを提供します。"}}},tags:["autodocs","deprecated"],argTypes:{open:{control:"boolean",description:"ダイアログの開閉状態"},title:{control:"text",description:"ダイアログのタイトル"},message:{control:"text",description:"表示するメッセージ"},showSaveDraft:{control:"boolean",description:"下書き保存ボタンを表示するか"},onDiscard:{action:"discarded",description:"変更を破棄する際のコールバック"},onSaveDraft:{action:"saved-draft",description:"下書きを保存する際のコールバック"},onCancel:{action:"cancelled",description:"キャンセル時のコールバック"}}},ee={args:{open:!0,title:"未保存の変更",message:"変更が保存されていません。このまま移動すると、変更は失われます。",onDiscard:()=>{},onCancel:()=>{}}},oe={args:{open:!0,title:"未保存の変更",message:"編集中の内容が保存されていません。",showSaveDraft:!0,onDiscard:()=>{},onSaveDraft:()=>{},onCancel:()=>{}}},te={args:{open:!0,title:"フォームの変更を破棄しますか？",message:"以下の項目に未保存の変更があります：",children:r.jsxs(le,{dense:!0,children:[r.jsx(B,{children:r.jsx(F,{primary:"タイトル",secondary:"旧: ドキュメント → 新: プロジェクト計画書"})}),r.jsx(B,{children:r.jsx(F,{primary:"説明",secondary:"変更あり（200文字追加）"})}),r.jsx(B,{children:r.jsx(F,{primary:"タグ",secondary:"3個のタグが追加されました"})})]}),onDiscard:()=>{},onCancel:()=>{}}},ae={args:{open:!0,title:"エディターを閉じますか？",message:"以下のファイルに未保存の変更があります：",showSaveDraft:!0,children:r.jsx(H,{sx:{mt:1},children:r.jsx(le,{dense:!0,children:[{name:"index.ts",status:"modified",lines:"+12, -5"},{name:"components/Dialog.tsx",status:"new",lines:"+145"},{name:"styles.css",status:"modified",lines:"+8, -3"}].map(e=>r.jsxs(B,{children:[r.jsx(F,{primary:e.name,secondary:e.lines}),r.jsx(ao,{label:e.status,size:"small",color:e.status==="new"?"success":"warning"})]},e.name))})}),onDiscard:()=>{},onSaveDraft:()=>{},onCancel:()=>{}}},re={args:{open:!0,title:"プロジェクト設定の変更",message:"プロジェクトの重要な設定が変更されています。これらの変更を保存せずに終了すると、すべての設定変更が失われ、デフォルト値にリセットされます。変更を確認してから続行してください。",showSaveDraft:!0,onDiscard:()=>{},onSaveDraft:()=>{},onCancel:()=>{}}},se={args:{open:!0,title:"重要な変更の破棄",message:"この操作は取り消すことができません。",children:r.jsx(H,{sx:{mt:2,p:2,bgcolor:"error.light",borderRadius:1},children:r.jsx(A,{variant:"body2",color:"error.contrastText",children:"⚠️ 警告: これらの変更には、システムの動作に影響する重要な設定が含まれています。 変更を破棄すると、これまでの作業がすべて失われます。"})}),onDiscard:()=>{},onCancel:()=>{}}},ne={args:{open:!0,title:"データ移行の中断",message:"データ移行プロセスが完了していません。",showSaveDraft:!1,children:r.jsxs(H,{sx:{mt:2},children:[r.jsx(A,{variant:"body2",paragraph:!0,children:"進行状況: 1,234 / 5,000 レコード (24.7%)"}),r.jsx(H,{sx:{width:"100%",bgcolor:"grey.300",borderRadius:1,overflow:"hidden"},children:r.jsx(H,{sx:{width:"24.7%",height:4,bgcolor:"primary.main"}})}),r.jsx(A,{variant:"caption",color:"text.secondary",sx:{mt:1,display:"block"},children:"中断すると、移行は最初からやり直しになります。"})]}),onDiscard:()=>{},onCancel:()=>{}}},ie={args:{open:!0,title:"フォームエラー",message:"入力内容にエラーがあります。修正せずに閉じますか？",showSaveDraft:!0,children:r.jsxs(le,{dense:!0,children:[r.jsx(B,{children:r.jsx(F,{primary:"メールアドレス",secondary:"無効な形式です",secondaryTypographyProps:{color:"error"}})}),r.jsx(B,{children:r.jsx(F,{primary:"パスワード",secondary:"8文字以上で入力してください",secondaryTypographyProps:{color:"error"}})}),r.jsx(B,{children:r.jsx(F,{primary:"利用規約",secondary:"同意が必要です",secondaryTypographyProps:{color:"error"}})})]}),onDiscard:()=>{},onSaveDraft:()=>{},onCancel:()=>{}}};var ve,be,xe;ee.parameters={...ee.parameters,docs:{...(ve=ee.parameters)==null?void 0:ve.docs,source:{originalSource:`{
  args: {
    open: true,
    title: '未保存の変更',
    message: '変更が保存されていません。このまま移動すると、変更は失われます。',
    onDiscard: () => {},
    onCancel: () => {}
  }
}`,...(xe=(be=ee.parameters)==null?void 0:be.docs)==null?void 0:xe.source}}};var Ce,Se,Ie;oe.parameters={...oe.parameters,docs:{...(Ce=oe.parameters)==null?void 0:Ce.docs,source:{originalSource:`{
  args: {
    open: true,
    title: '未保存の変更',
    message: '編集中の内容が保存されていません。',
    showSaveDraft: true,
    onDiscard: () => {},
    onSaveDraft: () => {},
    onCancel: () => {}
  }
}`,...(Ie=(Se=oe.parameters)==null?void 0:Se.docs)==null?void 0:Ie.source}}};var he,$e,Le;te.parameters={...te.parameters,docs:{...(he=te.parameters)==null?void 0:he.docs,source:{originalSource:`{
  args: {
    open: true,
    title: 'フォームの変更を破棄しますか？',
    message: '以下の項目に未保存の変更があります：',
    children: <List dense>
        <ListItem>
          <ListItemText primary="タイトル" secondary="旧: ドキュメント → 新: プロジェクト計画書" />
        </ListItem>
        <ListItem>
          <ListItemText primary="説明" secondary="変更あり（200文字追加）" />
        </ListItem>
        <ListItem>
          <ListItemText primary="タグ" secondary="3個のタグが追加されました" />
        </ListItem>
      </List>,
    onDiscard: () => {},
    onCancel: () => {}
  }
}`,...(Le=($e=te.parameters)==null?void 0:$e.docs)==null?void 0:Le.source}}};var De,Pe,we;ae.parameters={...ae.parameters,docs:{...(De=ae.parameters)==null?void 0:De.docs,source:{originalSource:`{
  args: {
    open: true,
    title: 'エディターを閉じますか？',
    message: '以下のファイルに未保存の変更があります：',
    showSaveDraft: true,
    children: <Box sx={{
      mt: 1
    }}>
        <List dense>
          {[{
          name: 'index.ts',
          status: 'modified',
          lines: '+12, -5'
        }, {
          name: 'components/Dialog.tsx',
          status: 'new',
          lines: '+145'
        }, {
          name: 'styles.css',
          status: 'modified',
          lines: '+8, -3'
        }].map(file => <ListItem key={file.name}>
              <ListItemText primary={file.name} secondary={file.lines} />
              <Chip label={file.status} size="small" color={file.status === 'new' ? 'success' : 'warning'} />
            </ListItem>)}
        </List>
      </Box>,
    onDiscard: () => {},
    onSaveDraft: () => {},
    onCancel: () => {}
  }
}`,...(we=(Pe=ae.parameters)==null?void 0:Pe.docs)==null?void 0:we.source}}};var Te,ke,Re;re.parameters={...re.parameters,docs:{...(Te=re.parameters)==null?void 0:Te.docs,source:{originalSource:`{
  args: {
    open: true,
    title: 'プロジェクト設定の変更',
    message: 'プロジェクトの重要な設定が変更されています。これらの変更を保存せずに終了すると、すべての設定変更が失われ、デフォルト値にリセットされます。変更を確認してから続行してください。',
    showSaveDraft: true,
    onDiscard: () => {},
    onSaveDraft: () => {},
    onCancel: () => {}
  }
}`,...(Re=(ke=re.parameters)==null?void 0:ke.docs)==null?void 0:Re.source}}};var je,Me,Ne;se.parameters={...se.parameters,docs:{...(je=se.parameters)==null?void 0:je.docs,source:{originalSource:`{
  args: {
    open: true,
    title: '重要な変更の破棄',
    message: 'この操作は取り消すことができません。',
    children: <Box sx={{
      mt: 2,
      p: 2,
      bgcolor: 'error.light',
      borderRadius: 1
    }}>
        <Typography variant="body2" color="error.contrastText">
          ⚠️ 警告: これらの変更には、システムの動作に影響する重要な設定が含まれています。
          変更を破棄すると、これまでの作業がすべて失われます。
        </Typography>
      </Box>,
    onDiscard: () => {},
    onCancel: () => {}
  }
}`,...(Ne=(Me=se.parameters)==null?void 0:Me.docs)==null?void 0:Ne.source}}};var ze,Ae,Be;ne.parameters={...ne.parameters,docs:{...(ze=ne.parameters)==null?void 0:ze.docs,source:{originalSource:`{
  args: {
    open: true,
    title: 'データ移行の中断',
    message: 'データ移行プロセスが完了していません。',
    showSaveDraft: false,
    children: <Box sx={{
      mt: 2
    }}>
        <Typography variant="body2" paragraph>
          進行状況: 1,234 / 5,000 レコード (24.7%)
        </Typography>
        <Box sx={{
        width: '100%',
        bgcolor: 'grey.300',
        borderRadius: 1,
        overflow: 'hidden'
      }}>
          <Box sx={{
          width: '24.7%',
          height: 4,
          bgcolor: 'primary.main'
        }} />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{
        mt: 1,
        display: 'block'
      }}>
          中断すると、移行は最初からやり直しになります。
        </Typography>
      </Box>,
    onDiscard: () => {},
    onCancel: () => {}
  }
}`,...(Be=(Ae=ne.parameters)==null?void 0:Ae.docs)==null?void 0:Be.source}}};var Fe,Ue,Oe;ie.parameters={...ie.parameters,docs:{...(Fe=ie.parameters)==null?void 0:Fe.docs,source:{originalSource:`{
  args: {
    open: true,
    title: 'フォームエラー',
    message: '入力内容にエラーがあります。修正せずに閉じますか？',
    showSaveDraft: true,
    children: <List dense>
        <ListItem>
          <ListItemText primary="メールアドレス" secondary="無効な形式です" secondaryTypographyProps={{
          color: 'error'
        }} />
        </ListItem>
        <ListItem>
          <ListItemText primary="パスワード" secondary="8文字以上で入力してください" secondaryTypographyProps={{
          color: 'error'
        }} />
        </ListItem>
        <ListItem>
          <ListItemText primary="利用規約" secondary="同意が必要です" secondaryTypographyProps={{
          color: 'error'
        }} />
        </ListItem>
      </List>,
    onDiscard: () => {},
    onSaveDraft: () => {},
    onCancel: () => {}
  }
}`,...(Oe=(Ue=ie.parameters)==null?void 0:Ue.docs)==null?void 0:Oe.source}}};const Do=["Default","WithSaveDraft","WithDetails","WithModifiedFiles","LongMessage","WithWarning","DataMigration","FormValidation"];export{ne as DataMigration,ee as Default,ie as FormValidation,re as LongMessage,te as WithDetails,ae as WithModifiedFiles,oe as WithSaveDraft,se as WithWarning,Do as __namedExportsOrder,Lo as default};
