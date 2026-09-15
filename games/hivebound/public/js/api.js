const TOKEN_KEY = 'hivebound_token';
export const api = {
  get token(){ return localStorage.getItem(TOKEN_KEY) || ''; },
  set token(v){ v ? localStorage.setItem(TOKEN_KEY,v) : localStorage.removeItem(TOKEN_KEY); },
  async request(path, options={}){
    const headers = { 'content-type':'application/json', ...(options.headers||{}) };
    if(this.token) headers.authorization = `Bearer ${this.token}`;
    const res = await fetch(path,{...options,headers});
    const data = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
  async register(username,password){ const d=await this.request('/api/register',{method:'POST',body:JSON.stringify({username,password})}); this.token=d.token; return d.user; },
  async login(username,password){ const d=await this.request('/api/login',{method:'POST',body:JSON.stringify({username,password})}); this.token=d.token; return d.user; },
  async me(){ return (await this.request('/api/me')).user; },
  async startRun(daily=false){ return this.request('/api/run/start',{method:'POST',body:JSON.stringify({daily})}); },
  async submitScore(payload){ return this.request('/api/scores',{method:'POST',body:JSON.stringify(payload)}); },
  async leaderboard(daily=false){ return (await this.request(`/api/leaderboard?daily=${daily?1:0}&limit=20`)).scores; }
};
