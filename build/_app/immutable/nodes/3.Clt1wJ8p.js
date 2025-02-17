import{t as j,a as Q}from"../chunks/CC3NEpcN.js";import{z as J,P as U,Y,L as N,M as R,N as $,q as z,a8 as B,i as F,a9 as H,p as K,d as c,s as l,a as g,g as v,b as W,c as n,r as u,t as X}from"../chunks/B7WCcYPB.js";import{d as Z,s as ee}from"../chunks/C1TnX-nQ.js";import{i as te,p as f}from"../chunks/DB4AqkKj.js";function I(e){J&&U(e)!==null&&Y(e)}let A=!1;function re(){A||(A=!0,document.addEventListener("reset",e=>{Promise.resolve().then(()=>{var t;if(!e.defaultPrevented)for(const r of e.target.elements)(t=r.__on_r)==null||t.call(r)})},{capture:!0}))}function ae(e){var t=$,r=z;N(null),R(null);try{return e()}finally{N(t),R(r)}}function se(e,t,r,s=r){e.addEventListener(t,()=>ae(r));const a=e.__on_r;a?e.__on_r=()=>{a(),s(!0)}:e.__on_r=()=>s(!0),re()}function G(e,t,r=t){var s=B();se(e,"input",a=>{var i=a?e.defaultValue:e.value;if(i=E(e)?k(i):i,r(i),s&&i!==(i=t())){var b=e.selectionStart,_=e.selectionEnd;e.value=i??"",_!==null&&(e.selectionStart=b,e.selectionEnd=Math.min(_,e.value.length))}}),(J&&e.defaultValue!==e.value||F(t)==null&&e.value)&&r(E(e)?k(e.value):e.value),H(()=>{var a=t();E(e)&&a===k(e.value)||e.type==="date"&&!a&&!e.value||a!==e.value&&(e.value=a??"")})}function E(e){var t=e.type;return t==="number"||t==="range"}function k(e){return e===""?null:+e}const ie=async(e,t,r,s)=>{try{n(t,"Executing query...");const a=await window.api.executeGraphQL(v(r));n(s,f(JSON.stringify(a,null,2))),n(t,f(a.success?"Query executed successfully!":"Query failed!"))}catch(a){n(s,f(JSON.stringify({error:a.message},null,2))),n(t,"Error executing query!")}setTimeout(()=>{n(t,"")},3e3)};var oe=(e,t,r)=>t(r,"Add project"),le=(e,t,r)=>t(r,"List projects"),ne=(e,t,r)=>t(r,"Schema"),ce=j('<div class="alert alert-info mb-3" role="alert"> </div>'),ue=j('<div class="card"><div class="card-body"><h5 class="card-title mb-3">GraphQL Explorer</h5> <div class="mb-3"><label for="queryEditor" class="form-label">Query</label> <div class="mb-2 d-flex gap-2"><button type="button" class="btn btn-outline-primary btn-sm"><i class="bi bi-plus-circle me-2"></i> Add Project</button> <button type="button" class="btn btn-outline-success btn-sm"><i class="bi bi-list me-2"></i> List Projects</button> <button type="button" class="btn btn-outline-secondary btn-sm"><i class="bi bi-code-square me-2"></i> Show Schema</button></div> <textarea id="queryEditor" class="form-control font-monospace svelte-1ggajxr" rows="8" placeholder="Enter your GraphQL query here..."></textarea></div> <div class="mb-3"><button type="button" class="btn btn-primary"><i class="bi bi-play-fill me-2"></i> Execute Query</button></div> <!> <div class="mb-3"><label for="resultViewer" class="form-label">Result</label> <textarea id="resultViewer" class="form-control font-monospace svelte-1ggajxr" rows="8" readonly="" placeholder="Query results will appear here..."></textarea></div></div></div>');function ve(e,t){K(t,!0);let r=g(`{
    project {
      id
      title
      description
    }
  }`),s=g(""),a=g("");const i=`{
      __schema {
        types {
          name
          fields {
            name
            type {
              name
              kind
            }
          }
        }
        mutationType {
          fields {
            name
            args {
              name
              type {
                name
                kind
              }
            }
          }
        }
      }
    }`,b=`mutation {
    insertIntoProject(values: [{
      title: "Project ${Math.random().toString(36).substring(7)}",
      description: "Description of the project"
    }]) {
      id
      title
      description
    }
  }`,_=`{
    project {
      id
      title
      description
    }
  }`,m=(o,d)=>{n(r,f(o))};var p=ue(),S=c(p),y=l(c(S),2),h=l(c(y),2),w=c(h);w.__click=[oe,m,b];var P=l(w,2);P.__click=[le,m,_];var M=l(P,2);M.__click=[ne,m,i],u(h);var L=l(h,2);I(L),u(y);var x=l(y,2),V=c(x);V.__click=[ie,a,r,s],u(x);var T=l(x,2);{var C=o=>{var d=ce(),D=c(d,!0);u(d),X(()=>ee(D,v(a))),Q(o,d)};te(T,o=>{v(a)&&o(C)})}var q=l(T,2),O=l(c(q),2);I(O),u(q),u(S),u(p),G(L,()=>v(r),o=>n(r,o)),G(O,()=>v(s),o=>n(s,o)),Q(e,p),W()}Z(["click"]);var _e=j('<div class="container py-4"><!></div>');function pe(e){var t=_e(),r=c(t);ve(r,{}),u(t),Q(e,t)}export{pe as component};
