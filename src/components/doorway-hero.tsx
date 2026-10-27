'use client';

import { ArrowDown, Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { entryEase, houseEntryFraming, houseEntryTiming, HOUSE_ENTRY_DURATION, sampleHouseEntry } from './house-entry';
import { HouseEntryWordmark } from './house-entry-wordmark';
import { createEntryPhotoWall, entryPhotoWallKey, type EntryPhotoWall } from './house-entry-wall';
import { ENTRY_VIDEO_SIZE, entryVideoProjection, entryVideoSource } from '@/lib/entry-video';

/** A recorded camera take; the transparent doorway exposes the current live collection. */
export function DoorwayHero({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null), stage = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null), photoWall = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null);
  const atlas = useRef<EntryPhotoWall | null>(null), progress = useRef(0);
  const sourceSize = useRef(ENTRY_VIDEO_SIZE.desktop as { width: number; height: number });
  const viewport = useRef({ width: 1440, height: 900 });
  const finished = useRef(false), userPaused = useRef(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [paused, setPaused] = useState(false), [arrived, setArrived] = useState(false);
  const [loadProgress, setLoadProgress] = useState(.04), [attempt, setAttempt] = useState(0);

  const prepareWall = useCallback(() => {
    const wall = photoWall.current, photo = atlas.current;
    if (!wall || !photo) return;
    const { width, height } = viewport.current;
    // Size the repeating plane once; animate only its compositor transform.
    // Four viewport widths cover the aperture at its smallest visible scale.
    wall.style.width = `${width * 4}px`; wall.style.height = `${height * 4}px`;
    wall.style.left = `${-width * 1.5}px`; wall.style.top = `${-height * 1.5}px`;
    wall.style.backgroundSize = `${photo.width}px ${photo.height}px`;
    wall.style.backgroundPosition = `${width * 2 - photo.worldWidth / 2 + photo.x}px ${height * 1.5 + photo.y}px`;
  }, []);

  const paint = useCallback((value: number) => {
    progress.current = value;
    const collection = world.current, foreground = stage.current, wall = photoWall.current;
    if (!collection || !foreground) return;
    const pose = sampleHouseEntry(value), open = pose.door > 0 || value === 1;
    collection.inert = value < 1;
    collection.style.visibility = open ? 'visible' : 'hidden';
    collection.style.setProperty('--entry-chrome', String(entryEase(.97, 1, value)));
    // The film is opaque until the door opens. Avoid repainting the hidden wall.
    if (!open) return;
    const { width, height } = viewport.current;
    const { x, y, scale } = entryVideoProjection(value, width, height, sourceSize.current);
    // An inherited CSS variable invalidates every product's computed style.
    // The same projection on this one layer avoids that full-tree work.
    collection.style.transform = value === 1 ? 'none' : `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    const photo = atlas.current;
    if (wall && photo) {
      wall.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      wall.style.opacity = String(1 - entryEase(.965, 1, value));
      wall.style.visibility = value < 1 ? 'visible' : 'hidden';
    }
  }, []);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    video.current?.pause();
    paint(1);
    root.current?.classList.add('house-entry-arrived');
    if (world.current) world.current.style.transform = 'none';
    setArrived(true); setPaused(false);
  }, [paint]);

  useEffect(() => {
    if (arrived) return;
    const collection = world.current!;
    let cancelled = false, revision = 0, queued = 0, key = '';
    const rebuild = async () => {
      queued = 0;
      const nextKey = entryPhotoWallKey(collection);
      if (!nextKey || nextKey === key) return;
      key = nextKey;
      const take = ++revision, next = await createEntryPhotoWall(collection);
      if (!next) return;
      if (cancelled || take !== revision) { URL.revokeObjectURL(next.url); return; }
      const previous = atlas.current;
      atlas.current = next;
      if (photoWall.current) photoWall.current.style.backgroundImage = `url("${next.url}")`;
      prepareWall();
      paint(progress.current);
      if (previous) URL.revokeObjectURL(previous.url);
    };
    const queue = () => { cancelAnimationFrame(queued); queued = requestAnimationFrame(() => { void rebuild(); }); };
    const observer = new MutationObserver(queue);
    observer.observe(collection, { childList: true, subtree: true });
    const resize = new ResizeObserver(queue); resize.observe(collection); queue();
    return () => {
      cancelled = true; revision++; observer.disconnect(); resize.disconnect(); cancelAnimationFrame(queued);
      if (atlas.current) { URL.revokeObjectURL(atlas.current.url); atlas.current = null; }
    };
  }, [arrived, paint, prepareWall]);

  useEffect(() => {
    const movie = video.current!;
    if (finished.current) return;
    const restoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let active = true, started = false, frame = 0, fallbackFrame = 0;
    const resize = () => {
      const rect = stage.current!.getBoundingClientRect();
      viewport.current = { width: rect.width, height: rect.height };
      const source = sourceSize.current;
      const cover = Math.max(rect.width / source.width, rect.height / source.height);
      root.current?.style.setProperty('--entry-wordmark-size', `${houseEntryFraming(source.width, source.height).size * cover}px`);
      prepareWall();
      paint(progress.current);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage.current!);
    const advance = (seconds: number) => paint(houseEntryTiming(Math.min(1, seconds / HOUSE_ENTRY_DURATION)));
    const nextFrame = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      if (!active || finished.current) return;
      advance(metadata.mediaTime);
      frame = movie.requestVideoFrameCallback(nextFrame);
    };
    const fallback = () => {
      if (!active || finished.current) return;
      advance(movie.currentTime);
      fallbackFrame = requestAnimationFrame(fallback);
    };
    const play = () => {
      if (document.hidden || finished.current || userPaused.current) return;
      void movie.play().catch(() => { if (active && !finished.current) { userPaused.current = true; setPaused(true); } });
    };
    const ready = () => {
      if (!active || started || finished.current) return;
      started = true; setLoadProgress(1); setStatus('ready');
      if (typeof movie.requestVideoFrameCallback === 'function') frame = movie.requestVideoFrameCallback(nextFrame);
      else fallbackFrame = requestAnimationFrame(fallback);
      play();
    };
    const loading = () => {
      if (movie.buffered.length && Number.isFinite(movie.duration))
        setLoadProgress(Math.max(.04, Math.min(1, movie.buffered.end(movie.buffered.length - 1) / movie.duration)));
    };
    const error = () => { if (active && !finished.current) setStatus('error'); };
    const visibility = () => { if (document.hidden) movie.pause(); else if (started) play(); };
    const motion = () => { if (reduced.matches) finish(); };
    const jump = (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href="#collectie"]') : null;
      if (!link || finished.current) return;
      event.preventDefault(); finish(); history.replaceState(null, '', '#collectie');
      if (link.classList.contains('skip-link')) world.current?.querySelector<HTMLElement>('#collectie')?.focus({ preventScroll: true });
    };
    movie.addEventListener('canplay', ready); movie.addEventListener('progress', loading);
    movie.addEventListener('error', error); movie.addEventListener('ended', finish);
    document.addEventListener('visibilitychange', visibility); document.addEventListener('click', jump);
    reduced.addEventListener('change', motion);
    if (reduced.matches) finish();
    else {
      const mobile = window.innerWidth / window.innerHeight < 1.25 || window.innerWidth < 700 || matchMedia('(pointer: coarse)').matches;
      sourceSize.current = ENTRY_VIDEO_SIZE[mobile ? 'mobile' : 'desktop'];
      resize();
      movie.muted = true;
      setStatus('loading'); setLoadProgress(.04);
      movie.src = entryVideoSource(navigator, mobile);
      movie.load();
    }
    return () => {
      active = false; movie.pause();
      if (frame) movie.cancelVideoFrameCallback(frame);
      cancelAnimationFrame(fallbackFrame); resizeObserver.disconnect();
      movie.removeEventListener('canplay', ready); movie.removeEventListener('progress', loading);
      movie.removeEventListener('error', error); movie.removeEventListener('ended', finish);
      document.removeEventListener('visibilitychange', visibility); document.removeEventListener('click', jump);
      reduced.removeEventListener('change', motion); history.scrollRestoration = restoration;
      movie.removeAttribute('src'); movie.load();
    };
  }, [attempt, finish, paint, prepareWall]);

  useEffect(() => {
    if (!arrived || !video.current) return;
    video.current.removeAttribute('src'); video.current.load();
  }, [arrived]);

  function togglePause() {
    const next = !userPaused.current;
    userPaused.current = next; setPaused(next);
    if (next) video.current?.pause();
    else void video.current?.play().catch(() => { userPaused.current = true; setPaused(true); });
  }

  return <div ref={root} className={`house-entry-experience house-entry-video house-entry-pinned house-entry-auto${arrived ? ' house-entry-arrived' : ''}`}>
    <div className={`house-entry-loader ${status === 'ready' || arrived ? 'is-complete' : ''}`} aria-hidden={status === 'ready' || arrived} inert={status === 'ready' || arrived}>
      <HouseEntryWordmark />
      <div className="house-entry-loader-identity">
        <span className="house-entry-logo-space" aria-hidden="true" />
        <p>Een huis voor cultuur en ontmoeting.</p>
        <div className="house-entry-loader-rule" role="progressbar" aria-label="De introductie wordt geladen" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(loadProgress * 100)} style={{ '--house-load': loadProgress } as CSSProperties}><span /></div>
        <span className="sr-only" role="status">{status === 'error' ? 'De introductie kon niet worden geladen.' : status === 'ready' ? 'De introductie is klaar.' : 'De introductie wordt geladen…'}</span>
        {status === 'error' && <div className="house-entry-loader-error"><p>De introductie kon niet worden geladen.</p><button onClick={() => setAttempt(value => value + 1)}>Probeer opnieuw <RotateCcw size={14} /></button></div>}
      </div>
      <a className="house-entry-loader-skip" href="#collectie">Naar de collectie <ArrowDown size={13} /></a>
    </div>
    <div className="house-entry-track"><section ref={stage} className={`house-entry-stage ${status === 'ready' ? 'is-ready' : ''}`} aria-label="Welkom bij LOTHUUS Vintage — een reis door de voordeur" inert={arrived}>
      <div ref={photoWall} className="house-entry-photo-wall" aria-hidden="true" />
      <video ref={video} className="house-entry-movie" muted playsInline preload="auto" disablePictureInPicture aria-hidden="true" />
      <h1 className="sr-only">LOTHUUS Vintage</h1>
      {status === 'ready' && !arrived && <>
        <button className={`house-entry-playback ${paused ? 'is-paused' : ''}`} onClick={togglePause} aria-label={paused ? 'Hervat de camerarit' : 'Pauzeer de camerarit'} aria-pressed={paused}>
          <span className="house-entry-pause-symbol" aria-hidden="true">{paused ? <Play size={28} strokeWidth={1.5} /> : <Pause size={28} strokeWidth={1.5} />}</span>
        </button>
        <div className="house-entry-flight-controls"><a href="#collectie">Overslaan <ArrowDown size={13} /></a></div>
      </>}
    </section></div>
    <div ref={world} className="house-entry-world">{children}</div>
  </div>;
}
