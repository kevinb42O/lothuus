'use client';

import Image from 'next/image';
import { ArrowDown } from 'lucide-react';
import { motion, useMotionTemplate, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionStyle } from 'motion/react';
import { useEffect, useRef } from 'react';
import vintageLogo from '../../public/brand/lothuus-vintage-v2.png';

/** The document keeps its native scroll; only the photograph and copy move. */
export function DoorwayHero() {
  const section = useRef<HTMLElement>(null);
  const collectionLink = useRef<HTMLAnchorElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });
  const photographScale = useTransform(scrollYProgress, [0, 0.85, 1], [1, 1.92, 1.96]);
  const photographTransform = useMotionTemplate`translateX(calc(${scrollYProgress} * var(--doorway-edge))) scale(${photographScale})`;
  const copyOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 0.5], [0, -55]);
  const washOpacity = useTransform(scrollYProgress, [0.25, 0.9], [0, 1]);
  useMotionValueEvent(scrollYProgress, 'change', progress => {
    // An invisible collection link must not remain a pointer or keyboard target.
    if (collectionLink.current) collectionLink.current.inert = !reducedMotion && progress >= 0.35;
  });
  useEffect(() => {
    if (collectionLink.current) collectionLink.current.inert = !reducedMotion && scrollYProgress.get() >= 0.35;
  }, [reducedMotion, scrollYProgress]);

  return <section ref={section} className="doorway-hero" aria-label="LOTHUUS Vintage — kom gerust binnen">
    <div className="doorway-stage">
      <motion.div className="doorway-photograph" style={reducedMotion ? undefined : { transform: photographTransform }}>
        <Image src="/hero/lothuus-doorkijk.webp" alt="Een verbeelde doorkijk naar een lichte kamer met een rode vintage fauteuil, keramiek en gekleurd glas." fill sizes="(max-width: 700px) 100vw, 80vw" preload />
      </motion.div>
      <motion.div className="doorway-copy" style={reducedMotion ? undefined : { '--doorway-copy-opacity': copyOpacity, y: copyY } as MotionStyle}>
        <h1 className="doorway-wordmark"><Image src={vintageLogo} alt="LOTHUUS VINTAGE — letters opgebouwd uit vintage objecten" sizes="(max-width: 700px) 90vw, 46vw" preload /></h1>
        <p className="doorway-invitation">Kom gerust<br /><em>binnen.</em></p>
        <p className="doorway-description">Bijzondere objecten uit een andere tijd.<br />Een huis vol nieuwe verhalen.</p>
        <a ref={collectionLink} href="#collectie" className="doorway-link">Ontdek de collectie <span><ArrowDown size={19} strokeWidth={1.3} aria-hidden="true" /></span></a>
      </motion.div>
      <motion.div className="doorway-caption" style={reducedMotion ? undefined : { '--doorway-copy-opacity': copyOpacity } as MotionStyle}>
        <span>Met gevoel verzameld.<br />Om verder te leven.</span>
        <span>Een verbeelding van de LOTHUUS-sfeer.</span>
      </motion.div>
      <motion.div className="doorway-wash" aria-hidden="true" style={reducedMotion ? undefined : { '--doorway-wash-opacity': washOpacity } as MotionStyle} />
    </div>
  </section>;
}
