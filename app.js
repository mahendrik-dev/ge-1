const IND={P:"Persatuan",K:"Keadilan",R:"Kepercayaan",H:"Hukum"};
const root=document.getElementById("app"),$=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let story,user,S;
const show=h=>{root.innerHTML=h;window.scrollTo(0,0)};

async function api(action,d={}){
  if(!API_URL)return demo(action,d);
  try{ // text/plain menghindari preflight CORS pada Apps Script
    const r=await fetch(API_URL,{method:"POST",body:JSON.stringify({action,token:user&&user.token,...d})});
    return await r.json();
  }catch(e){return{ok:false,error:"Tidak dapat terhubung ke server. Coba lagi."}}
}
function demo(action,d){
  const db=JSON.parse(localStorage.getItem("jw_demo")||'{"u":{}}');
  if(action==="login"||action==="register"){
    if(!d.username)return{ok:false,error:"Isi username."};
    return{ok:true,username:d.username};
  }
  if(action==="finish"){
    const u=db.u[user.username]=db.u[user.username]||{endings:[],best:0};
    if(!u.endings.includes(d.ending))u.endings.push(d.ending);
    u.best=Math.max(u.best,d.skor);
    localStorage.setItem("jw_demo",JSON.stringify(db));
    return{ok:true};
  }
  if(action==="leaderboard")
    return{ok:true,rows:Object.entries(db.u).map(([n,v])=>({username:n,endings:v.endings.length,best:v.best})).sort((a,b)=>b.endings-a.endings||b.best-a.best)};
  return{ok:true};
}

function meters(){
  return'<div class="meters">'+Object.keys(IND).map(k=>`<div class="m${S.ind[k]<=3?" low":""}"><span>${IND[k]}</span><div class="bar" role="img" aria-label="${IND[k]} ${S.ind[k]} dari 10"><i style="width:${S.ind[k]*10}%"></i></div></div>`).join("")+"</div>";
}

function showLogin(msg=""){
  show(`<section class="card"><h1>Jalan Warga</h1>
  <p>Setiap pilihanmu ikut membentuk Indonesia. Waktu bermain sekitar 60 menit.</p>
  ${API_URL?"":'<p class="note">Mode demo: data tersimpan di peramban ini saja.</p>'}
  <label>Username<input id="u" autocomplete="username"></label>
  ${API_URL?'<label>Kata sandi<input id="p" type="password" autocomplete="current-password"></label>':""}
  <p class="err" role="alert">${esc(msg)}</p>
  <div class="row"><button class="main" id="bin">Masuk</button>${API_URL?'<button id="bup">Daftar</button>':""}</div></section>`);
  const go=async a=>{
    const r=await api(a,{username:$("u").value.trim(),password:API_URL?$("p").value:""});
    if(r.ok){user=r;if(!story)story=await(await fetch("data/story.json")).json();menu()}else showLogin(r.error||"Gagal masuk.");
  };
  $("bin").onclick=()=>go("login");
  if(API_URL)$("bup").onclick=()=>go("register");
}

function menu(){
  show(`<section class="card"><h1>Halo, ${esc(user.username)}</h1>
  <p>Kamu akan menghadapi 14 keputusan dalam tiga babak. Perhatikan empat ukuran di atas layar: Persatuan, Keadilan, Kepercayaan, dan Hukum.</p>
  <button class="main" id="go">Mulai bermain</button><button id="lb">Lihat papan peringkat</button></section>`);
  $("go").onclick=start;$("lb").onclick=board;
}

function start(){S={ind:{P:5,K:5,R:5,H:5},flags:[],i:0,babak:0,log:[]};next()}

function next(){
  while(S.i<story.keputusan.length){
    const q=story.keputusan[S.i];
    if(!q.syarat||S.flags.includes(q.syarat)){
      if(q.babak!==S.babak){S.babak=q.babak;return intro(q)}
      return ask(q);
    }
    S.i++;
  }
  finish();
}

function intro(q){
  const b=story.babak[q.babak-1];
  show(meters()+`<section class="card"><p class="meta">Babak ${q.babak}</p><h2>${esc(b.judul)}</h2><p>${esc(b.intro)}</p><button class="main" id="ok">Lanjut</button></section>`);
  $("ok").onclick=()=>ask(q);
}

function ask(q){
  show(meters()+`<section class="card"><p class="meta">Babak ${q.babak}: ${esc(story.babak[q.babak-1].judul)}</p>
  <p class="npc">${esc(q.npc)}</p><p>${esc(q.teks)}</p>
  ${q.opsi.map((o,i)=>`<button data-i="${i}">${esc(o.t)}</button>`).join("")}</section>`);
  root.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>choose(q,+b.dataset.i));
}

function choose(q,i){
  const o=q.opsi[i],d=[];
  for(const k in o.e){S.ind[k]=Math.max(0,Math.min(10,S.ind[k]+o.e[k]));d.push(`${IND[k]} ${o.e[k]>0?"+":"−"}${Math.abs(o.e[k])}`)}
  if(o.f)S.flags.push(o.f);
  S.log.push({q:q.id,t:o.t,u:o.u});
  api("log",{pertanyaan:q.id,jawaban:i,efek:o.e,skor:S.ind});
  show(meters()+`<section class="card fb"><p class="meta">Pilihanmu: ${esc(o.t)}</p><p>${esc(o.u)}</p><p class="note">${d.join(", ")}</p><button class="main" id="ok">Lanjut</button></section>`);
  $("ok").onclick=()=>{S.i++;next()};
}

function endingKey(){
  const{P,K,R,H}=S.ind,avg=(P+K+R+H)/4;
  if(avg>=7&&Math.min(P,K,R,H)>=5)return"emas";
  if(avg<=3.5)return"hilang";
  if(P>=6&&H<=4)return"rukun";
  if(H>=6&&P<=4)return"tegak";
  return"tengah";
}

async function finish(){
  const key=endingKey(),e=story.ending[key],skor=Object.values(S.ind).reduce((a,b)=>a+b,0);
  api("finish",{ending:key,skor,flags:S.flags});
  show(meters()+`<section class="card"><p class="meta">Indonesia 2045</p><h1>${esc(e.judul)}</h1><p>${esc(e.teks)}</p></section>
  <section class="card fb"><h2>Refleksi</h2><p>Pilihan mana yang terasa paling sulit? Jika diulang, apa yang akan kamu ubah, dan mengapa?</p>
  <ol class="rk">${S.log.map(l=>`<li>${esc(l.t)}<br><span class="note">${esc(l.u)}</span></li>`).join("")}</ol>
  <button class="main" id="again">Main lagi untuk menemukan ending lain</button><button id="lb">Lihat papan peringkat</button></section>`);
  $("again").onclick=start;$("lb").onclick=board;
}

async function board(){
  const r=await api("leaderboard");
  show(`<section class="card"><h1>Papan peringkat</h1><p class="note">Diurutkan menurut jumlah ending berbeda yang ditemukan.</p>
  ${r.ok?`<ol class="rk">${r.rows.slice(0,20).map(x=>`<li>${esc(x.username)}: ${esc(x.endings)} ending, skor terbaik ${esc(x.best)}</li>`).join("")}</ol>`:`<p class="err">${esc(r.error||"Gagal memuat.")}</p>`}
  <button class="main" id="back">Kembali</button></section>`);
  $("back").onclick=menu;
}

showLogin();
