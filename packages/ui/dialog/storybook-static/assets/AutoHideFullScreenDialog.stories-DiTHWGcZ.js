import{c as L,j as e,I as V,S as O,B as d,a as k,T as o}from"./Save-DNwg0ee0.js";import{A as w}from"./AutoHideFullScreenDialog-CB-VFyQo.js";import"./iframe-DFl9RHSL.js";import"./preload-helper-C1FmrZbK.js";import"./index-Di1Mf8tn.js";const R=L(e.jsx("path",{d:"M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"})),U=L(e.jsx("path",{d:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m1 15h-2v-6h2zm0-8h-2V7h2z"})),X={title:"ui/legacy-dialog/AutoHideFullScreenDialog",component:w,parameters:{layout:"fullscreen",docs:{description:{component:"フルスクリーンダイアログコンポーネント。自動非表示機能とコントロールバーのアニメーションを備えています。"}}},tags:["autodocs","deprecated"],argTypes:{title:{control:"text",description:"ダイアログのタイトル"},subtitle:{control:"text",description:"オプションのサブタイトル"},open:{control:"boolean",description:"ダイアログの開閉状態"},autoHide:{control:"boolean",description:"自動非表示機能の有効/無効"},autoHideDelay:{control:"number",description:"自動非表示までの遅延時間（ミリ秒）"},onClose:{action:"closed",description:"ダイアログを閉じる際のコールバック"}}},t=()=>e.jsxs(k,{sx:{p:3},children:[e.jsx(o,{variant:"h6",gutterBottom:!0,children:"ダイアログコンテンツ"}),e.jsx(o,{paragraph:!0,children:"これはAutoHideFullScreenDialogのサンプルコンテンツです。 マウスを動かさないと、コントロールバーが自動的に非表示になります。"}),e.jsx(o,{paragraph:!0,children:"マウスを画面上部に移動すると、タイトルバーが表示されます。 画面下部に移動すると、フッターアクションが表示されます。"}),[...Array(10)].map((G,p)=>e.jsxs(o,{paragraph:!0,children:["ダミーテキスト ",p+1,": Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris."]},p))]}),n={args:{title:"AutoHide FullScreen Dialog",open:!0,onClose:()=>{},children:e.jsx(t,{})}},r={args:{title:"ドキュメントビューアー",subtitle:"最終更新: 2024年8月30日",open:!0,onClose:()=>{},children:e.jsx(t,{})}},s={args:{title:"システム情報",subtitle:"バージョン 1.0.0",icon:e.jsx(U,{}),open:!0,onClose:()=>{},children:e.jsx(t,{})}},a={args:{title:"エディター",icon:e.jsx(R,{}),titleActions:e.jsx(e.Fragment,{children:e.jsx(V,{size:"small",sx:{color:"inherit"},children:e.jsx(O,{})})}),open:!0,onClose:()=>{},children:e.jsx(t,{})}},i={args:{title:"設定",footerActions:e.jsxs(e.Fragment,{children:[e.jsx(d,{variant:"outlined",children:"キャンセル"}),e.jsx(d,{variant:"contained",children:"保存"})]}),open:!0,onClose:()=>{},children:e.jsx(t,{})}},l={args:{title:"自動非表示有効",subtitle:"マウスを3秒間動かさないとバーが非表示になります",autoHide:!0,autoHideDelay:3e3,open:!0,onClose:()=>{},children:e.jsx(t,{})}},c={args:{title:"自動非表示無効",subtitle:"コントロールバーは常に表示されます",autoHide:!1,open:!0,onClose:()=>{},children:e.jsx(t,{})}},u={args:{title:"プラグインレジストリ",subtitle:"利用可能なプラグイン一覧",icon:e.jsx(U,{}),titleActions:e.jsx(V,{size:"small",sx:{color:"inherit"},children:e.jsx(R,{})}),footerActions:e.jsxs(e.Fragment,{children:[e.jsx(d,{variant:"outlined",children:"閉じる"}),e.jsx(d,{variant:"contained",startIcon:e.jsx(O,{}),children:"選択したプラグインをインストール"})]}),autoHide:!0,autoHideDelay:5e3,open:!0,onClose:()=>{},children:e.jsx(t,{})}};var m,h,x;n.parameters={...n.parameters,docs:{...(m=n.parameters)==null?void 0:m.docs,source:{originalSource:`{
  args: {
    title: 'AutoHide FullScreen Dialog',
    open: true,
    onClose: () => {},
    children: <SampleContent />
  }
}`,...(x=(h=n.parameters)==null?void 0:h.docs)==null?void 0:x.source}}};var g,j,S;r.parameters={...r.parameters,docs:{...(g=r.parameters)==null?void 0:g.docs,source:{originalSource:`{
  args: {
    title: 'ドキュメントビューアー',
    subtitle: '最終更新: 2024年8月30日',
    open: true,
    onClose: () => {},
    children: <SampleContent />
  }
}`,...(S=(j=r.parameters)==null?void 0:j.docs)==null?void 0:S.source}}};var C,A,I;s.parameters={...s.parameters,docs:{...(C=s.parameters)==null?void 0:C.docs,source:{originalSource:`{
  args: {
    title: 'システム情報',
    subtitle: 'バージョン 1.0.0',
    icon: <InfoIcon />,
    open: true,
    onClose: () => {},
    children: <SampleContent />
  }
}`,...(I=(A=s.parameters)==null?void 0:A.docs)==null?void 0:I.source}}};var b,H,B;a.parameters={...a.parameters,docs:{...(b=a.parameters)==null?void 0:b.docs,source:{originalSource:`{
  args: {
    title: 'エディター',
    icon: <EditIcon />,
    titleActions: <>
        <IconButton size="small" sx={{
        color: 'inherit'
      }}>
          <SaveIcon />
        </IconButton>
      </>,
    open: true,
    onClose: () => {},
    children: <SampleContent />
  }
}`,...(B=(H=a.parameters)==null?void 0:H.docs)==null?void 0:B.source}}};var f,v,D;i.parameters={...i.parameters,docs:{...(f=i.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    title: '設定',
    footerActions: <>
        <Button variant="outlined">キャンセル</Button>
        <Button variant="contained">保存</Button>
      </>,
    open: true,
    onClose: () => {},
    children: <SampleContent />
  }
}`,...(D=(v=i.parameters)==null?void 0:v.docs)==null?void 0:D.source}}};var y,F,E;l.parameters={...l.parameters,docs:{...(y=l.parameters)==null?void 0:y.docs,source:{originalSource:`{
  args: {
    title: '自動非表示有効',
    subtitle: 'マウスを3秒間動かさないとバーが非表示になります',
    autoHide: true,
    autoHideDelay: 3000,
    open: true,
    onClose: () => {},
    children: <SampleContent />
  }
}`,...(E=(F=l.parameters)==null?void 0:F.docs)==null?void 0:E.source}}};var z,W,T;c.parameters={...c.parameters,docs:{...(z=c.parameters)==null?void 0:z.docs,source:{originalSource:`{
  args: {
    title: '自動非表示無効',
    subtitle: 'コントロールバーは常に表示されます',
    autoHide: false,
    open: true,
    onClose: () => {},
    children: <SampleContent />
  }
}`,...(T=(W=c.parameters)==null?void 0:W.docs)==null?void 0:T.source}}};var M,_,q;u.parameters={...u.parameters,docs:{...(M=u.parameters)==null?void 0:M.docs,source:{originalSource:`{
  args: {
    title: 'プラグインレジストリ',
    subtitle: '利用可能なプラグイン一覧',
    icon: <InfoIcon />,
    titleActions: <IconButton size="small" sx={{
      color: 'inherit'
    }}>
        <EditIcon />
      </IconButton>,
    footerActions: <>
        <Button variant="outlined">閉じる</Button>
        <Button variant="contained" startIcon={<SaveIcon />}>
          選択したプラグインをインストール
        </Button>
      </>,
    autoHide: true,
    autoHideDelay: 5000,
    open: true,
    onClose: () => {},
    children: <SampleContent />
  }
}`,...(q=(_=u.parameters)==null?void 0:_.docs)==null?void 0:q.source}}};const Y=["Default","WithSubtitle","WithIcon","WithTitleActions","WithFooterActions","AutoHideEnabled","AutoHideDisabled","CompleteExample"];export{c as AutoHideDisabled,l as AutoHideEnabled,u as CompleteExample,n as Default,i as WithFooterActions,s as WithIcon,r as WithSubtitle,a as WithTitleActions,Y as __namedExportsOrder,X as default};
