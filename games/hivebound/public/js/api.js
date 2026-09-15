const TOKEN_KEY = 'hivebound_token';

// The same files are served two ways: behind `server.js` (Docker, or the game
// on its own) where /api answers, and as a static site on arcade.mjodheim.be
// where it does not exist at all. The game asks once, then stops pretending
// there is a Hive to log into.
let backend = null;

function dailySeed(){
  const d=new Date();
  const key=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  let h=2166136261;
  for(const ch of key){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return Math.abs(h>>>0);
}
function randomSeed(){return crypto.getRandomValues(new Uint32Array(1))[0]}

export const api = {
  get token(){ return localStorage.getItem(TOKEN_KEY) || ''; },
  set token(v){ v ? localStorage.setItem(TOKEN_KEY,v) : localStorage.removeItem(TOKEN_KEY); },
  // `null` until the question has been asked, so nothing renders a login form
  // on a guess.
  get online(){ return backend === true; },
  async probe(){
    if(backend !== null) return backend;
    try{
      const res = await fetch('/api/health', { headers:{ accept:'application/json' } });
      const type = res.headers.get('content-type') || '';
      // A static host answers /api/health with its own 404 page, which is
      // neither ok nor JSON.
      backend = res.ok && type.includes('json');
    }catch{
      backend = false;
    }
    return backend;
  },
  async request(path, options={}){
    const headers = { 'content-type':'application/json', ...(options.headers||{}) };
    if(this.token) headers.authorization = `Bearer ${this.token}`;
    let res;
    try{
      res = await fetch(path,{...options,headers});
    }catch{
      backend = false;
      throw new Error('The Hive is unreachable from here.');
    }
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    backend = true;
    return data;
  },
  async register(username,password){ const d=await this.request('/api/register',{method:'POST',body:JSON.stringify({username,password})}); this.token=d.token; return d.user; },
  async login(username,password){ const d=await this.request('/api/login',{method:'POST',body:JSON.stringify({username,password})}); this.token=d.token; return d.user; },
  async me(){ return (await this.request('/api/me')).user; },
  async startRun(daily=false){
    try{return await this.request('/api/run/start',{method:'POST',body:JSON.stringify({daily})})}
    catch{
      return {runId:`local-${crypto.randomUUID()}`,seed:daily?dailySeed():randomSeed(),daily,offline:true};
    }
  },
  async submitScore(payload){ return this.request('/api/scores',{method:'POST',body:JSON.stringify(payload)}); },
  async leaderboard(daily=false){
    try{return (await this.request(`/api/leaderboard?daily=${daily?1:0}&limit=20`)).scores}
    catch{return []}
  }
};
