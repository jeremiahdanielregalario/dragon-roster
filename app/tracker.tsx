'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronLeft, ChevronRight, CircleHelp, Cloud, Download, Heart, Layers3, LoaderCircle, Moon, RefreshCw, Search, Shield, SlidersHorizontal, Sparkles, Sun, Swords, Trophy, Upload, UserRound, X, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';
import { filterDragons, parseCollection, rankChange } from '@/lib/collection';
import { elementNames, modeNames, modes, rarityNames, type Collection, type Dragon, type Mode, type Rankings, type Status } from '@/lib/types';

const modeIcons = {overall: Layers3, damage: Zap, tank: Shield, support: Heart, arena: Trophy};
const modeHints = {overall:'All battle stats', damage:'Attack output', tank:'Life & defense', support:'Team utility', arena:'Battle value'};
const statusNames = {owned:'Owned', acquired:'Newly acquired', summon:'Can summon'};
const lists = [{id:'all',name:'All dragons',icon:Layers3},{id:'tracked',name:'My collection',icon:Swords},{id:'owned',name:'Owned',icon:Shield},{id:'acquired',name:'Acquired',icon:Sparkles},{id:'summon',name:'Can summon',icon:Zap}];
const PAGE_SIZE = 24;
const guestKey = 'dragon-roster:guest:v1';
const when = (date: string) => new Date(date).toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});

function Modal({title, children, onClose}: {title:string; children: React.ReactNode; onClose:()=>void}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {ref.current?.showModal();}, []);
  return <dialog ref={ref} onCancel={onClose} onClick={e => {if(e.target === ref.current) onClose();}} aria-label={title}>
    <div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></div>{children}
  </dialog>;
}

function Change({now, before}: {now:number; before?:number}) {
  const value = rankChange(now, before);
  if (value === null) return <span className="movement neutral" title="No earlier snapshot for this dragon">—</span>;
  return <span className={`movement ${value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'}`} title={value === 0 ? 'No rank change' : `${Math.abs(value)} places ${value > 0 ? 'higher' : 'lower'} than the previous snapshot`}>
    {value > 0 ? <ArrowUp size={12}/> : value < 0 ? <ArrowDown size={12}/> : null}{value === 0 ? '—' : Math.abs(value)}
  </span>;
}

export default function Tracker() {
  const [data, setData] = useState<Rankings | null>(null);
  const [loadError, setLoadError] = useState('');
  const [collection, setCollection] = useState<Collection>({});
  const [user, setUser] = useState<User | null>(null);
  const [collectionReady, setCollectionReady] = useState(false);
  const [collectionError, setCollectionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [list, setList] = useState('all');
  const [mode, setMode] = useState<Mode>('overall');
  const [rarity, setRarity] = useState('');
  const [element, setElement] = useState('');
  const [changesOnly, setChangesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [light, setLight] = useState(false);
  const [account, setAccount] = useState(false);
  const [help, setHelp] = useState(false);
  const [email, setEmail] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<Dragon | null>(null);
  const [history, setHistory] = useState<{fetched_at:string; ranks: Record<Mode,number>}[]>([]);
  const [historyState, setHistoryState] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const collectionRef = useRef<Collection>({});
  const savingRef = useRef(false);
  const userRef = useRef<User | null>(null);
  const collectionEpoch = useRef(0);

  const loadRankings = useCallback(async () => {
    try {
      const response = await fetch('/api/rankings');
      if (!response.ok) throw new Error('The ranking list could not be loaded. Please try again.');
      setData(await response.json()); setLoadError('');
    } catch (error) {setLoadError(error instanceof Error ? error.message : 'Connection failed.');}
  }, []);
  const loadCollection = useCallback(async (currentUser: User | null) => {
    if (savingRef.current) return;
    const epoch = ++collectionEpoch.current;
    setCollectionReady(false); setCollectionError('');
    try {
      let next: Collection;
      if (currentUser && supabase) {
        const rows: {dragon_id:number;status:string;acquired_at:string|null}[] = [];
        for (let offset = 0; ; offset += 1000) {
          const {data: batch, error} = await supabase.from('dragon_collection').select('dragon_id,status,acquired_at').eq('user_id', currentUser.id).order('dragon_id').range(offset, offset + 999);
          if (error) throw new Error('Your cloud collection could not be loaded. Check your connection and retry.');
          rows.push(...(batch || []));
          if (!batch || batch.length < 1000) break;
        }
        next = parseCollection(Object.fromEntries(rows.map(row => [row.dragon_id, {status:row.status, acquiredAt:row.acquired_at}])));
      } else {
        const raw = localStorage.getItem(guestKey);
        next = raw ? parseCollection(JSON.parse(raw)) : {};
      }
      if (epoch !== collectionEpoch.current) return;
      collectionRef.current = next; setCollection(next); setCollectionReady(true);
    } catch (error) {
      if (epoch === collectionEpoch.current) setCollectionError(error instanceof Error ? error.message : 'Could not read your saved collection.');
    }
  }, []);

  useEffect(() => {
    void loadRankings();
    try {setLight(localStorage.getItem('dragon-roster:theme') === 'light');} catch {}
    let alive = true;
    if (!supabase) {void loadCollection(null); return;}
    // Keep database calls outside Supabase's synchronous auth callback.
    const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      const next = session?.user || null;
      if (next?.id === userRef.current?.id && collectionRef.current && _event === 'TOKEN_REFRESHED') return;
      userRef.current = next; setUser(next);
      setTimeout(() => {if(alive) void loadCollection(next);}, 0);
    });
    return () => {alive = false; listener.subscription.unsubscribe();};
  }, [loadRankings, loadCollection]);
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === 'visible') {void loadRankings(); if (!savingRef.current) void loadCollection(userRef.current);}
    };
    window.addEventListener('focus', revalidate);
    const interval = setInterval(revalidate, 60000);
    const storage = (e: StorageEvent) => {if(e.key === guestKey && !userRef.current) void loadCollection(null);};
    window.addEventListener('storage', storage);
    return () => {window.removeEventListener('focus', revalidate);window.removeEventListener('storage', storage);clearInterval(interval);};
  }, [loadCollection, loadRankings]);
  useEffect(() => {setPage(1);}, [query,list,rarity,element,mode,changesOnly]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController(); setHistory([]); setHistoryState('Loading ranking history…');
    fetch(`/api/history?id=${selected.id}`, {signal: controller.signal}).then(async r => {
      if (!r.ok) throw new Error('History is temporarily unavailable.');
      const rows = await r.json(); setHistory(rows); setHistoryState(rows.length < 2 ? 'History builds as rankings change. At least two saved snapshots are needed to show movement.' : '');
    }).catch(e => {if(e.name !== 'AbortError') setHistoryState(e.message);});
    return () => controller.abort();
  }, [selected]);

  const counts = useMemo(() => ({all:data?.dragons.length || 0, tracked:Object.keys(collection).length, owned:Object.values(collection).filter(d=>d.status==='owned'||d.status==='acquired').length, acquired:Object.values(collection).filter(d=>d.status==='acquired').length, summon:Object.values(collection).filter(d=>d.status==='summon').length}), [data,collection]);
  const filtered = useMemo(() => data ? filterDragons(data.dragons,collection,{query,list,rarity,element,mode,changesOnly,previous:data.previous}) : [], [data,collection,query,list,rarity,element,mode,changesOnly]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  const moved = data?.dragons.filter(d=>collection[d.id] && data.previous[d.id] && data.previous[d.id][mode] !== d.ranks[mode]).length || 0;

  async function saveStatus(id: number, status: string) {
    if (!collectionReady || savingRef.current) return;
    savingRef.current = true; setSaving(true); ++collectionEpoch.current;
    const next = {...collectionRef.current};
    if (!status) delete next[id];
    else next[id] = {status:status as Status, acquiredAt:status === 'acquired' ? (next[id]?.acquiredAt || new Date().toISOString()) : next[id]?.acquiredAt || null};
    try {
      if (user && supabase) {
        const result = status ? await supabase.from('dragon_collection').upsert({user_id:user.id,dragon_id:id,status,acquired_at:next[id].acquiredAt,updated_at:new Date().toISOString()}) : await supabase.from('dragon_collection').delete().eq('user_id',user.id).eq('dragon_id',id);
        if (result.error) throw new Error('Could not save to your account. Your previous selection is unchanged.');
      } else localStorage.setItem(guestKey, JSON.stringify(next));
      collectionRef.current = next; setCollection(next);
      setNotice(status ? `Saved as ${statusNames[status as Status].toLowerCase()}.` : 'Removed from your collection.');
    } catch(error) {setNotice(error instanceof Error ? error.message : 'Could not save. Device storage may be full.');}
    finally {savingRef.current = false; setSaving(false);}
  }
  async function mergeCollection(imported: Collection) {
    if (!collectionReady || savingRef.current) throw new Error('Wait for your collection to finish loading or saving.');
    savingRef.current = true; setSaving(true); ++collectionEpoch.current;
    try {
      // Existing cloud choices win when importing a device backup.
      const next = {...imported, ...collectionRef.current};
      if (user && supabase) {
        const rows = Object.entries(imported).filter(([id])=>!collectionRef.current[id]).map(([id,item])=>({user_id:user.id,dragon_id:Number(id),status:item.status,acquired_at:item.acquiredAt}));
        if (rows.length) {const {error} = await supabase.from('dragon_collection').upsert(rows,{onConflict:'user_id,dragon_id',ignoreDuplicates:true}); if(error) throw new Error('Import could not be saved to your account.');}
      } else localStorage.setItem(guestKey, JSON.stringify(next));
      collectionRef.current = next;setCollection(next);setNotice('Backup merged. Existing collection choices were kept.');
    } finally {savingRef.current=false;setSaving(false);}
  }
  async function refresh() {
    setRefreshing(true);setNotice('');
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const response = await fetch('/api/sync',{method:'POST',headers:session?{Authorization:`Bearer ${session.access_token}`}:{}});
      const result = await response.json();
      if(!response.ok) throw new Error(result.error || 'Refresh failed.');
      setNotice(result.message);await loadRankings();
    } catch(error) {setNotice(error instanceof Error ? error.message : 'Could not connect. Your last rankings are safe.');}
    finally {setRefreshing(false);}
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),collection},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const link=document.createElement('a');link.href=url;link.download='dragon-roster-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importBackup(file?: File) {
    if(!file) return;
    try {
      if(file.size>2_000_000) throw new Error('Choose a Dragon Roster backup smaller than 2 MB.');
      const payload=JSON.parse(await file.text());
      if(payload.version!==1) throw new Error('Unsupported backup version.');
      await mergeCollection(parseCollection(payload.collection));
    } catch(error) {setNotice(error instanceof Error ? error.message : 'Invalid backup.');}
    if(inputRef.current) inputRef.current.value='';
  }
  const switchTheme = () => {setLight(!light);try{localStorage.setItem('dragon-roster:theme',light?'dark':'light');}catch{}};

  return <div className={`app ${light?'light':''}`}>
    <a className="skip-link" href="#rankings">Skip to rankings</a>
    <header className="topbar"><div className="topbar-inner">
      <a href="/" className="brand"><span className="brand-mark"><Swords size={23}/></span><span>DRAGON<span className="brand-light">ROSTER</span><small>YOUR COLLECTION, RANKED</small></span></a>
      <nav className="topnav" aria-label="Main navigation"><button className={list==='all'?'active':''} onClick={()=>setList('all')}><Trophy size={16}/> Rankings</button><button className={list!=='all'?'active':''} onClick={()=>setList('tracked')}><Swords size={16}/> My collection</button></nav>
      <div className="top-actions"><button className="icon-button" onClick={switchTheme} aria-label={light?'Use dark theme':'Use light theme'}>{light?<Moon size={18}/>:<Sun size={18}/>}</button><button className="account-button" onClick={()=>setAccount(true)}><UserRound size={16}/><span>{user?'My account':'Sign in to sync'}</span></button></div>
    </div></header>

    <main className="workspace">
      <div className="breadcrumb">Dragon City <ChevronRight size={12}/> Battle league <ChevronRight size={12}/><span>Dragon rankings</span></div>
      <section className="hero">
        <div><div className="eyebrow gold"><Trophy size={13}/> BATTLE LEAGUE INDEX</div><h1>Your dragons.<br className="mobile-break"/> Their place in the league.</h1><p>Track your collection, follow the rankings, and find your next contender.</p><div className="hero-meta"><span><span className="status-dot"/> {data?`${data.dragons.length.toLocaleString()} dragons indexed`:'Loading the league…'}</span><span>Rankings by <a href="https://www.ditlep.com/dragon/rank" target="_blank" rel="noreferrer">Ditlep <ArrowUpRight size={11}/></a></span></div></div>
        <div className="hero-seal" aria-hidden="true"><div><Swords size={38}/><span>YOUR LEAGUE</span><small>DRAGON CITY</small></div></div>
      </section>

      <div className="content-grid">
        <aside className="sidebar">
          <div className="side-label">YOUR FIELD GUIDE</div>
          <nav className="collection-nav" aria-label="Collection filters">{lists.map(item=><button key={item.id} className={list===item.id?'selected':''} onClick={()=>setList(item.id)} aria-pressed={list===item.id}><item.icon size={17}/><span>{item.name}</span><b>{counts[item.id as keyof typeof counts].toLocaleString()}</b></button>)}</nav>
          <div className="side-note"><div className="side-note-icon"><Cloud size={21}/></div><strong>{user?'Your collection, everywhere':'Take your roster with you'}</strong><p>{user?'Your saved dragons sync to your account. Open this app on your phone to pick up where you left off.':'Sign in to keep your dragons in sync across your phone and computer.'}</p><button className="text-button" onClick={()=>setAccount(true)}>{user?'Manage account':'Connect your account'} <ArrowUpRight size={14}/></button></div>
          <div className="side-footer"><button onClick={()=>setHelp(true)}><CircleHelp size={15}/> How tracking works</button><a href="https://www.ditlep.com/dragon/rank" target="_blank" rel="noreferrer">View source rankings <ArrowUpRight size={14}/></a></div>
        </aside>

        <div className="main-column">
          <div className="role-tabs" role="tablist" aria-label="Ranking role">{modes.map(item=>{const Icon=modeIcons[item];return <button role="tab" aria-selected={mode===item} key={item} className={mode===item?'active':''} onClick={()=>setMode(item)}><span className="role-icon"><Icon size={19}/></span><span><strong>{modeNames[item]}</strong><small>{modeHints[item]}</small></span></button>;})}</div>
          <section className="filter-panel" aria-label="Find a contender"><div className="filter-heading"><span className="filter-icon"><SlidersHorizontal size={19}/></span><div><h2>Find a contender</h2><p>Your next best dragon might already be in your collection.</p></div></div>
            <div className="filter-row"><div className="search-box"><Search size={18}/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search dragons, families, or skills…" aria-label="Search dragons"/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={14}/></button>}</div><select aria-label="Filter by element" value={element} onChange={e=>setElement(e.target.value)}><option value="">All elements</option>{Object.entries(elementNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></div>
            <div className="filter-bottom"><div className="rarities" aria-label="Filter by rarity"><span>RARITY</span><button className={!rarity?'chosen':''} onClick={()=>setRarity('')} aria-pressed={!rarity}>All</button>{Object.entries(rarityNames).map(([key,name])=><button key={key} className={`rarity-chip rarity-${key} ${rarity===key?'chosen':''}`} title={name} aria-label={name} aria-pressed={rarity===key} onClick={()=>setRarity(rarity===key?'':key)}>{key==='V'?'VR':key}</button>)}</div><label className="changes-toggle"><input type="checkbox" checked={changesOnly} onChange={e=>setChangesOnly(e.target.checked)}/> Rank changes only</label></div>
          </section>

          {collectionError&&<div className="notice error" role="alert">{collectionError}<button onClick={()=>loadCollection(user)}>Retry collection</button></div>}
          {data?.warning&&<div className="source-note"><CircleHelp size={15}/><span>{data.warning}</span><button onClick={()=>setHelp(true)}>Details</button></div>}
          {notice&&<div className="notice" role="status"><span>{notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
          {loadError&&<div className="notice error" role="alert">{loadError}<button onClick={loadRankings}>Retry</button></div>}

          <section id="rankings" className="rankings" aria-label="Dragon rankings">
            <div className="results-heading"><div><div className="eyebrow gold">{list==='all'?'LEAGUE STANDINGS':'YOUR COLLECTION'}</div><h2>{list==='all'?`${modeNames[mode]} ranking`:list==='tracked'?'My collection':lists.find(l=>l.id===list)?.name}<span className="count-badge">{filtered.length.toLocaleString()}</span></h2></div><button className="refresh-button" onClick={refresh} disabled={refreshing}><RefreshCw size={15} className={refreshing?'spin':''}/><span>{refreshing?'Checking…':'Refresh rankings'}</span></button></div>
            <div className="results-meta"><span>{data?`Last checked ${when(data.checkedAt)}`:'Fetching rankings…'}{data?.storage==='bundled'?' · Saved snapshot':''}</span><span>{data?.previousAt?`Changes since ${when(data.previousAt)}`:'Movement appears after the next changed snapshot'}</span></div>
            {list!=='all'&&counts.tracked>0&&<div className="collection-summary"><Swords size={16}/><span><b>{counts.owned}</b> owned</span><span><b>{counts.summon}</b> summonable</span><span><b>{moved}</b> rank changes</span><button onClick={()=>setAccount(true)}>Backup & sync <ArrowUpRight size={13}/></button></div>}
            {!data&&!loadError?<div className="empty-state"><LoaderCircle className="spin"/><h3>Opening the league…</h3><p>Loading the latest saved dragon rankings.</p></div>:null}
            {data&&filtered.length===0?<div className="empty-state"><Search size={30}/><h3>{list!=='all'&&counts.tracked===0?'Build your dragon roster':'No dragons match these filters'}</h3><p>{list!=='all'&&counts.tracked===0?'Browse all dragons and mark the ones you own, recently acquired, or can summon.':'Try another name, choose a different rarity, or clear your filters.'}</p><button className="primary-button" onClick={()=>{setQuery('');setRarity('');setElement('');setChangesOnly(false);setList('all');}}>Browse all dragons <ChevronRight size={16}/></button></div>:null}
            <div className="dragon-list">{visible.map(dragon=><article key={dragon.id} className={`dragon-card ${dragon.ranks[mode]<=3?'podium':''} ${collection[dragon.id]?'tracked':''}`}>
              <div className="dragon-main"><div className="rank-position"><small>RANK</small><strong>{dragon.ranks[mode]}</strong><Change now={dragon.ranks[mode]} before={data?.previous[dragon.id]?.[mode]}/></div>
                <button className="dragon-portrait" onClick={()=>setSelected(dragon)} aria-label={`View ${dragon.name}`}><img src={dragon.image||'/icon.svg'} alt="" loading="lazy" onError={e=>{e.currentTarget.src='/icon.svg';}}/><span className={`rarity-badge rarity-${dragon.rarity}`}>{dragon.rarity}</span></button>
                <div className="dragon-info"><div className="elements">{dragon.elements.map(el=><span key={el} className={`element element-${el}`} title={elementNames[el]||el}>{elementNames[el]||el}</span>)}<span className="category">CAT {dragon.category}</span></div><button className="dragon-name" onClick={()=>setSelected(dragon)}>{dragon.name}<ArrowUpRight size={14}/></button><div className="dragon-subtitle">{rarityNames[dragon.rarity]||dragon.rarity}<span>·</span>{dragon.skills[0]||'Standard skills'}{collection[dragon.id]&&<span className="tracked-label"><Check size={11}/>{statusNames[collection[dragon.id].status]}</span>}</div></div>
                <div className="score"><span>{modeNames[mode]} score</span><strong>{dragon.scores[mode].toFixed(1)}<small>/100</small></strong><div className="score-meter"><i style={{width:`${Math.min(100,dragon.scores[mode])}%`}}/></div><small>{dragon.confidence.toFixed(0)}% confidence</small></div>
              </div>
              <div className="dragon-bottom"><div className="stats">{Object.entries(dragon.stats).map(([name,value])=><div key={name}><span>{name}</span><b>{value.toFixed(0)}</b></div>)}</div><label className="status-select"><span className="sr-only">Track {dragon.name}</span><select value={collection[dragon.id]?.status||''} disabled={!collectionReady||saving} onChange={e=>saveStatus(dragon.id,e.target.value)} aria-label={`Track ${dragon.name}`}><option value="">＋ Track dragon</option><option value="owned">✓ Owned</option><option value="acquired">✦ Newly acquired</option><option value="summon">◇ Can summon</option></select></label></div>
            </article>)}</div>
            {filtered.length>0&&<div className="pagination"><span>Showing {(currentPage-1)*PAGE_SIZE+1}–{Math.min(currentPage*PAGE_SIZE,filtered.length)} of {filtered.length.toLocaleString()}</span><div><button aria-label="Previous page" disabled={currentPage<=1} onClick={()=>{setPage(currentPage-1);document.getElementById('rankings')?.scrollIntoView({behavior:'smooth'});}}><ChevronLeft size={16}/></button><span>{currentPage} / {pages}</span><button aria-label="Next page" disabled={currentPage>=pages} onClick={()=>{setPage(currentPage+1);document.getElementById('rankings')?.scrollIntoView({behavior:'smooth'});}}><ChevronRight size={16}/></button></div></div>}
          </section>
          <footer className="page-footer"><span><Swords size={14}/> Your dragons. Your strategy.</span><p>Independent fan tracker. Rankings from <a href="https://www.ditlep.com/dragon/rank" target="_blank" rel="noreferrer">Ditlep</a>. Dragon City artwork belongs to Socialpoint. Not affiliated with either.</p></footer>
        </div>
      </div>
    </main>

    {account&&<Modal title={user?'Your account':'Keep your collection in sync'} onClose={()=>setAccount(false)}>
      {user?<><p className="muted">Signed in as <strong>{user.email}</strong>. Your collection is private to this account.</p><button className="secondary-button" disabled={saving} onClick={async()=>{const {error}=await supabase!.auth.signOut();if(error)setAuthMessage(error.message);else setAccount(false);}}>Sign out</button></>:<>
        <p className="muted">Use the same email on your phone and computer. We’ll email you a secure sign-in link.</p>
        {supabase?<form onSubmit={async e=>{e.preventDefault();setAuthBusy(true);setAuthMessage('');const {error}=await supabase!.auth.signInWithOtp({email,options:{emailRedirectTo:window.location.origin}});setAuthMessage(error?error.message:'Check your email and open the sign-in link on this device.');setAuthBusy(false);}}><label className="field-label" htmlFor="email">Email address</label><input id="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/><button className="primary-button full" disabled={authBusy}>{authBusy?<LoaderCircle size={16} className="spin"/>:<Cloud size={16}/>} Send sign-in link</button></form>:<div className="setup-box"><Cloud size={22}/><h3>Cloud connection is pending</h3><p>Your collection can be saved on this device now. Connect Supabase using the project’s SETUP.md guide to enable sign-in and phone sync.</p></div>}
      </>}
      {authMessage&&<p role="status" className="notice">{authMessage}</p>}
      <div className="backup-section"><h3>Collection backup</h3><p className="muted">Export a copy or merge a backup. Existing choices are kept. {user?'Import your device collection below to add dragons saved before sign-in.':'Guest collections stay on this browser until imported into an account.'}</p><div className="button-row"><button className="secondary-button" onClick={exportBackup} disabled={!collectionReady||saving}><Download size={16}/> Export</button><button className="secondary-button" onClick={()=>inputRef.current?.click()} disabled={!collectionReady||saving}><Upload size={16}/> Import</button>{user&&<button className="secondary-button" disabled={!collectionReady||saving} onClick={async()=>{try{await mergeCollection(parseCollection(JSON.parse(localStorage.getItem(guestKey)||'{}')));}catch(e){setNotice(e instanceof Error?e.message:'Could not import device collection.');}}}>Import this device</button>}</div><input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={e=>importBackup(e.target.files?.[0])}/></div>
    </Modal>}

    {help&&<Modal title="How your tracker works" onClose={()=>setHelp(false)}><div className="help-content"><h3>A collection you control</h3><p>Mark dragons as Owned, Newly acquired, or Can summon. Acquired dragons also count as owned. These are your own labels; the tracker doesn’t read your game account or orb balance.</p><h3>Rankings that stay up to date</h3><p>Once cloud setup is complete, Ditlep is checked daily during 8–9 AM Philippine time. The owner can also refresh manually, at most once an hour. This screen checks for saved updates every minute and when you return to it.</p><h3>Movement, without guesswork</h3><p>Arrows compare the current role rank with the previous changed snapshot. A dash means unchanged or no earlier record. The last 30 changed snapshots are retained; history starts with your first cloud refresh.</p><h3>Safe when the source is unavailable</h3><p>If a refresh fails or returns an incomplete list, the last successful snapshot stays visible. Ditlep’s feed is unofficial and may change. Confidence and score breakdowns come from Ditlep’s model.</p><h3>Use it on your phone</h3><p>Open your published Vercel URL and sign in with the same email. In Safari, choose Share → Add to Home Screen. In Chrome, use Add to Home screen or Install app. An internet connection is required for rankings and cloud sync.</p><a className="text-button" href="https://www.ditlep.com/dragon/rank" target="_blank" rel="noreferrer">Visit the ranking source <ArrowUpRight size={15}/></a></div></Modal>}

    {selected&&<Modal title={selected.name} onClose={()=>setSelected(null)}><div className="detail-hero"><img src={selected.image||'/icon.svg'} alt={selected.name} onError={e=>{e.currentTarget.src='/icon.svg';}}/><div><span className="eyebrow gold">{rarityNames[selected.rarity]} · CATEGORY {selected.category}</span><h3>#{selected.ranks[mode]} in {modeNames[mode]}</h3><p className="muted">{selected.summonOrbs?`${selected.summonOrbs} orbs to summon`:'Summon requirement unavailable'} · {selected.confidence}% confidence</p></div></div><div className="detail-scores">{modes.map(m=><div key={m}><small>{modeNames[m]}</small><strong>{selected.scores[m].toFixed(1)}</strong><span>Rank #{selected.ranks[m]}</span></div>)}</div><h3 className="detail-title">Ranking history · {modeNames[mode]}</h3>{historyState&&<p className="muted">{historyState}</p>}{history.length>0&&<div className="history-list">{history.slice().reverse().map((point,index)=><div key={point.fetched_at}><span>{when(point.fetched_at)}</span><b>#{point.ranks[mode]}</b><Change now={point.ranks[mode]} before={history[history.length-index-2]?.ranks[mode]}/></div>)}</div>}{selected.skills.length>0&&<><h3 className="detail-title">Skills</h3><p className="muted">{selected.skills.join(' · ')}</p></>}{selected.warnings.length>0&&<details className="source-warnings"><summary>Source scoring notes ({selected.warnings.length})</summary>{selected.warnings.map((note,i)=><p key={i}>{note}</p>)}</details>}<a className="primary-button" href={`https://www.ditlep.com/dragons/${selected.id}/${encodeURIComponent(selected.slug)}`} target="_blank" rel="noreferrer">View on Ditlep <ArrowUpRight size={16}/></a></Modal>}
  </div>;
}
