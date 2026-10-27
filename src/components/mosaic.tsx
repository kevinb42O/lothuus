'use client';

import { MosaicPhoto, prepareMosaicPhoto } from './mosaic-photo';
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { categories, categoryLabel, type CollectionObject } from '@/lib/collection';
import { HeartButton } from './heart-button';
import { useElasticGrid } from './use-elastic-grid';
import { useMosaicReveal } from './use-mosaic-reveal';
import { collectionLayout, type ActiveCell } from '@/lib/grid-layout';
import { PointerIntent, type IntentTarget } from '@/lib/pointer-intent';
import { categoryDirection, collectionColumns, filterTransition, type TileBounds } from '@/lib/filter-transition';
import { captureWall, CollectionWall, type CapturedWall } from './collection-wall';
import { useVisibleMosaicPhotos } from './use-visible-mosaic-photos';
import { needsNativeGrid } from './house-device';
import { NativeMosaic } from './native-mosaic';
import { settlePhotoPreparation } from '@/lib/mosaic-photo-source';

type Props = { objects: CollectionObject[]; filterKey: string; focused: boolean; onOpen: (object: CollectionObject) => void; saved: string[]; onToggle: (id: string) => void };

function TileFrame(props: HTMLMotionProps<'div'>) {
  const present = useIsPresent();
  return <motion.div {...props} data-present={present} inert={!present} aria-hidden={!present || undefined} />;
}

export function Mosaic(props:Props){
  const [native,setNative]=useState<boolean|null>(null);
  // Choose before mounting either grid. iOS never constructs the animated tiles.
  useEffect(()=>setNative(needsNativeGrid(navigator)),[]);
  if(native===null)return null;
  return native?<NativeMosaic {...props}/>:<AnimatedMosaic {...props}/>;
}

function AnimatedMosaic({ objects: requestedObjects, filterKey, focused, onOpen, saved, onToggle }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [presentation, setPresentation] = useState(() => ({
    objects: requestedObjects, focused, filterKey, revision: 0,
    keys: Object.fromEntries(requestedObjects.map(object => [object.id, `${object.id}:0`])),
    arriving: new Set<string>(),
  }));
  const { objects } = presentation;
  const committed = useRef(presentation);
  const [wall, setWall] = useState<{ frame: CapturedWall; direction: -1 | 1; revision: number } | null>(null);
  const wallFrame = useRef<typeof wall>(null);
  const wallElement = useRef<HTMLDivElement>(null);
  const [changing, setChanging] = useState(false);
  const busy = useRef(false);
  const revision = useRef(0);
  const release = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<ActiveCell | null>(null);
  const generation = useRef(0);
  const measuredWidth = useRef(0);
  const candidate = useRef<string | null>(null);
  const intent = useRef(new PointerIntent());
  const intentFrame = useRef(0);
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const reduced = useReducedMotion();
  const columns = collectionColumns(width, presentation.focused);
  const gap = presentation.focused ? width > 500 ? 14 : 10 : width > 500 ? 10 : 7;
  const cell = Math.max(0, (width - gap * (columns - 1)) / columns);
  const idsKey = objects.map(object => object.id).join(',');
  const ids = useMemo(() => idsKey ? idsKey.split(',') : [], [idsKey]);
  const layout = useMemo(() => collectionLayout(ids, columns, active, cell, gap), [ids, columns, active, cell, gap]);
  const visiblePhotos=useVisibleMosaicPhotos(container,`${width}:${presentation.revision}:${idsKey}`);
  const clearPending = useCallback(() => {
    generation.current++;
  }, []);
  const clearIntent = useCallback(() => {
    cancelAnimationFrame(intentFrame.current); intentFrame.current = 0; intent.current.reset(); cursor.current = null;
  }, []);
  const resetHover = useCallback(() => { clearIntent(); clearPending(); candidate.current = null; }, [clearIntent, clearPending]);
  const settle = useCallback(() => { resetHover(); setActive(null); }, [resetHover]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (Math.abs(entry.contentRect.width - measuredWidth.current) < .5) return;
      measuredWidth.current = entry.contentRect.width;
      setWidth(entry.contentRect.width); settle();
    });
    if (container.current) observer.observe(container.current);
    window.addEventListener('blur', settle);
    const visibility = () => { if (document.hidden) settle(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); clearIntent(); clearPending(); window.removeEventListener('blur', settle); document.removeEventListener('visibilitychange', visibility); };
  }, [clearIntent, clearPending, settle]);
  useEffect(() => { settle(); }, [ids, settle]);
  const expandedCell = layout.cells.find(cell => cell.expanded);
  const revealing = useMosaicReveal(container, expandedCell, !!reduced, resetHover, clearIntent);
  const elastic = useElasticGrid(container, columns, !!reduced || changing, ids.join(','), resetHover, revealing);

  useEffect(() => {
    if (!width) return;
    const current = committed.current;
    if (requestedObjects === current.objects && filterKey === current.filterKey && focused === current.focused) {
      // Returning to the current filter can cancel an image preparation still in flight.
      if (release.current) clearTimeout(release.current);
      if (wallFrame.current && !reduced) {
        release.current = setTimeout(() => { busy.current = false; setChanging(false); clearIntent(); }, 740);
      } else {
        busy.current = false; setChanging(false);
      }
      return;
    }
    if (filterKey === current.filterKey && focused === current.focused && requestedObjects.length === current.objects.length && requestedObjects.every((object, index) => object.id === current.objects[index].id)) {
      const next = { ...current, objects: requestedObjects };
      committed.current = next; setPresentation(next);
      return;
    }
    let cancelled = false;
    busy.current = true; setChanging(true); clearIntent(); clearPending();
    elastic.stop.current();
    if (release.current) clearTimeout(release.current);
    const nextRevision = ++revision.current;
    const nextColumns = collectionColumns(width, focused);
    const nextGap = focused ? width > 500 ? 14 : 10 : width > 500 ? 10 : 7;
    const nextCell = (width - nextGap * (nextColumns - 1)) / nextColumns;
    const nextLayout = collectionLayout(requestedObjects.map(object => object.id), nextColumns, null, nextCell, nextGap);
    async function prepare() {
      const grid = container.current;
      if (!grid) return;
      const top = grid.getBoundingClientRect().top;
      // Decode the arriving viewport and a spare row while the current collection remains visible.
      const visible = nextLayout.cells.filter(cell => top + cell.y < window.innerHeight + nextCell && top + cell.y + cell.height > 0);
      await settlePhotoPreparation(visible.map(cell => prepareMosaicPhoto(requestedObjects.find(object => object.id === cell.id)!,cell.width)));
      if (cancelled || !container.current) return;
      const previous = new Map<string, TileBounds & { key: string }>();
      container.current.querySelectorAll<HTMLElement>('[data-id][data-present="true"]').forEach(tile => {
        const rect = tile.getBoundingClientRect();
        previous.set(tile.dataset.id!, { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, key: tile.dataset.tileKey! });
      });
      const gridTop = container.current.getBoundingClientRect().top;
      const plan = filterTransition(nextLayout.cells, previous, gridTop, window.innerHeight, nextRevision);
      setActive(null);
      const direction = categoryDirection(current.filterKey, filterKey, categories.map(category => category.id)) || wallFrame.current?.direction || 0;
      if (direction && !reduced) {
        // Preserve the actual painted wall, including a partly revealed previous category.
        const frame = captureWall(container.current, wallFrame.current?.frame, wallElement.current);
        const nextWall = { frame, direction, revision: nextRevision };
        wallFrame.current = nextWall;
        setWall(nextWall);
        plan.arriving.clear();
      } else {
        wallFrame.current = null; setWall(null);
      }
      const next = { objects: requestedObjects, focused, filterKey, revision: nextRevision, ...plan };
      committed.current = next;
      setPresentation(next);
      release.current = setTimeout(() => {
        busy.current = false; setChanging(false); clearIntent();
      }, reduced ? 0 : direction ? 740 : 620);
    }
    void prepare();
    return () => { cancelled = true; };
  }, [requestedObjects, filterKey, focused, width, reduced, clearIntent, clearPending, elastic.stop]);
  useEffect(() => () => { if (release.current) clearTimeout(release.current); }, []);
  useEffect(() => {
    if (reduced) { wallFrame.current = null; setWall(null); }
  }, [reduced]);

  async function show(id: string, button: HTMLButtonElement, keyboard = false) {
    if (busy.current) return;
    if (id === active?.id) { clearPending(); candidate.current = id; return; }
    if (candidate.current === id) return;
    clearPending(); candidate.current = id;
    const request = generation.current;
    let image = button.querySelector('img');
    if (!container.current) return;
    try {
      // Home/End can focus a tile outside the mounted photo window.
      if (!image && keyboard) {
        const object = objects.find(object => object.id === id);
        if (object) image = await prepareMosaicPhoto(object, cell);
      } else if (image) await image.decode();
    } catch { if (request === generation.current) candidate.current = null; return; }
    if (!image) { candidate.current = null; return; }
    if (request !== generation.current || !button.isConnected || busy.current) return;
    // Decoding may finish after the pointer has left, a dialog opened, or tiles moved.
    if (!keyboard && (!pointerButton(id) || elastic.scrolling.current)) { candidate.current = null; return; }
    const bounds = container.current.getBoundingClientRect();
    const rect = button.getBoundingClientRect();
    // Anchor the expansion where the photo is NOW, including interrupted motion.
    const column = Math.max(0, Math.min(columns - 1, Math.floor((rect.left - bounds.left + rect.width / 2) / (cell + gap))));
    const row = Math.max(0, Math.floor((rect.top - bounds.top + rect.height / 2) / (cell + gap)));
    setActive({ id, column, row, aspectRatio: image.naturalWidth / image.naturalHeight, maxPhotoHeight: Math.max(180, Math.min(620, window.innerHeight - 180)) });
  }

  function snapshot(): IntentTarget[] {
    return Array.from(container.current?.querySelectorAll<HTMLButtonElement>('[data-object]') ?? []).map(button => {
      const rect = button.getBoundingClientRect();
      return { id: button.dataset.object!, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    }).filter(rect => rect.bottom > 0 && rect.top < window.innerHeight);
  }
  function pointerButton(id: string) {
    const point = cursor.current;
    if (!point || document.hidden || document.body.style.overflow === 'hidden') return null;
    const button = document.elementFromPoint(point.x, point.y)?.closest<HTMLButtonElement>('[data-object]');
    return button?.dataset.object === id && container.current?.contains(button) ? button : null;
  }
  function land(id: string | null) {
    if (!id) return;
    const button = pointerButton(id);
    if (button) void show(id, button);
  }
  function finishJourney(now: number) {
    intentFrame.current = 0;
    if (elastic.scrolling.current) { clearIntent(); clearPending(); candidate.current = null; return; }
    land(intent.current.finish(now));
    if (intent.current.tracking) intentFrame.current = requestAnimationFrame(finishJourney);
  }
  const movement = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 38, mass: .85, restDelta: .2, restSpeed: 2 };

  const filterMovement = reduced ? { duration: 0 } : { duration: .56, ease: [.16, 1, .3, 1] as const };
  return <div className="mosaic-wrap" aria-busy={changing}>
    <motion.div ref={container} className="mosaic mosaic-fluid" aria-label="Interactieve objectencollectie"
      inert={!!wall || undefined}
      data-filtering={changing} data-focused={presentation.focused} data-filter={presentation.filterKey}
      initial={false} animate={{ height: layout.height }} transition={changing ? filterMovement : movement}
      onPointerMove={event => {
        if (busy.current || revealing.current || elastic.scrolling.current || event.pointerType !== 'mouse' || !window.matchMedia('(min-width: 768px) and (any-hover: hover)').matches) return;
        if (event.buttons || document.body.style.overflow === 'hidden') { clearIntent(); clearPending(); candidate.current = null; return; }
        cursor.current = { x: event.clientX, y: event.clientY };
        const point = intent.current.point;
        // Small corrections retain an in-flight image decode; only renewed travel cancels it.
        if (point && Math.hypot(event.clientX - point.x, event.clientY - point.y) < (intent.current.tracking ? 1.5 : 8)) {
          intent.current.move({ x: event.clientX, y: event.clientY, time: performance.now() }, snapshot); return;
        }
        clearPending(); candidate.current = null;
        land(intent.current.move({ x: event.clientX, y: event.clientY, time: performance.now() }, snapshot));
        if (intent.current.tracking && !intentFrame.current) intentFrame.current = requestAnimationFrame(finishJourney);
      }}
      onPointerEnter={() => { clearPending(); candidate.current = null; }}
      onPointerLeave={resetHover}
      onPointerCancel={settle}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) settle(); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); settle(); } }}>
      <AnimatePresence initial={false}>
      {width > 0 && objects.map((object, index) => {
        const position = layout.cells[index];
        const expanded = position.expanded;
        const photoVisible=expanded||visiblePhotos.has(object.id);
        const arriving = presentation.arriving.has(object.id);
        return <TileFrame key={presentation.keys[object.id]} className={`object-tile ${expanded ? 'is-expanded' : ''}`} data-photo-visible={photoVisible} data-id={object.id} data-tile-key={presentation.keys[object.id]} data-row={position.row} data-column={position.column} data-span={position.span}
          style={{ '--elastic-shift': `var(--elastic-${position.column}, 0px)` } as CSSProperties}
          transformTemplate={(_, transform) => `${transform === 'none' ? '' : transform} translateY(var(--elastic-shift, 0px))`}
          initial={arriving && !reduced ? { x: position.x, y: position.y + 18, width: position.width, height: position.height, opacity: 0 } : false}
          animate={{ x: position.x, y: position.y, width: position.width, height: position.height, opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : .16 } }}
          transition={changing ? filterMovement : movement}>
          <button data-object={object.id} className="object-button" aria-expanded={expanded}
            aria-label={`${object.title}, ${categoryLabel(object.category)}. ${object.availability === 'reserved' ? 'Gereserveerd. ' : object.availability === 'sold' ? 'Verkocht. ' : ''}Bekijk het object`}
            onFocus={event => {
              if (!event.currentTarget.matches(':focus-visible') || window.innerWidth < 768) return;
              const button = event.currentTarget;
              requestAnimationFrame(() => {
                if (button !== document.activeElement || !button.isConnected) return;
                clearIntent(); elastic.stop.current(); void show(object.id, button, true);
              });
            }}
            onClick={() => { clearIntent(); clearPending(); candidate.current = null; onOpen(object); }}
            onKeyDown={event => {
              const deltas: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns, Home: -index, End: objects.length - 1 - index };
              if (event.key in deltas) {
                event.preventDefault(); clearIntent(); clearPending(); candidate.current = null;
                const next = Math.max(0, Math.min(objects.length - 1, index + deltas[event.key]));
                container.current?.querySelector<HTMLButtonElement>(`[data-object="${objects[next].id}"]`)?.focus({ preventScroll: true });
              }
            }}>
            <span className="object-photograph">{photoVisible&&<MosaicPhoto key={object.image} object={object} width={position.width} />}</span>
            {object.availability && object.availability !== 'available' && <span className={`stock-badge ${object.availability}`}>{object.availability === 'reserved' ? 'Gereserveerd' : 'Verkocht'}</span>}
            <motion.span className="fluid-caption" initial={false} animate={{ opacity: expanded ? 1 : 0 }} transition={{ duration: reduced ? 0 : .18 }} aria-hidden={!expanded}>
              <span><span className="object-category">{categoryLabel(object.category)}{object.availability === 'reserved' ? ' · Gereserveerd' : object.availability === 'sold' ? ' · Verkocht' : ''}</span><strong className="object-title">{object.title}</strong></span>
              <ArrowUpRight size={19} strokeWidth={1.3} />
            </motion.span>
          </button>
          <HeartButton className={`grid-heart ${saved.includes(object.id) ? 'saved-marker' : ''}`} selected={saved.includes(object.id)} size={22} aria-label={`${saved.includes(object.id) ? 'Verwijder' : 'Bewaar'} ${object.title} ${saved.includes(object.id) ? 'uit' : 'in'} je selectie`}
            onPointerDown={() => { clearIntent(); clearPending(); candidate.current = null; }}
            onClick={() => onToggle(object.id)} />
        </TileFrame>;
      })}
      </AnimatePresence>
      {wall && <CollectionWall key={wall.revision} ref={wallElement} wall={wall.frame} direction={wall.direction}
        onComplete={() => {
          if (wallFrame.current?.revision !== wall.revision) return;
          wallFrame.current = null; setWall(null);
        }} />}
    </motion.div>
    <p className="sr-only" aria-live="polite">{objects.length} objecten in de collectie.</p>
  </div>;
}
