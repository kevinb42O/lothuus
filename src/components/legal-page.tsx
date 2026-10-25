import type { ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import './legal-page.css';
export function LegalLinks({newTab=false}: {newTab?:boolean}) {
  return <nav className="legal-links" aria-label="Juridische informatie"><a href="/algemene-voorwaarden" target={newTab?'_blank':undefined} rel={newTab?'noreferrer':undefined}>Algemene voorwaarden</a><a href="/privacy" target={newTab?'_blank':undefined} rel={newTab?'noreferrer':undefined}>Privacy</a></nav>;
}
export function LegalPage({title,intro,sections}: {title:string;intro:string;sections:{id:string;title:string;body:ReactNode}[]}) {
  return <div className="legal-page"><a className="skip-link" href="#legal-content">Naar inhoud</a><header className="legal-header"><a className="wordmark" href="/" aria-label="LOTHUUS, naar de website"><b>LO</b><span>THUUS</span></a><a className="text-link" href="/#collectie"><ArrowLeft size={16} />Terug naar de collectie</a></header><main id="legal-content"><div className="legal-intro"><h1>{title}</h1><p>{intro}</p><p className="legal-updated">Bijgewerkt op 25 oktober 2026</p></div><div className="legal-layout"><nav className="legal-contents" aria-label="Op deze pagina">{sections.map(section=><a key={section.id} href={`#${section.id}`}>{section.title}<ArrowUpRight size={13} /></a>)}</nav><article>{sections.map(section=><section id={section.id} key={section.id}><h2>{section.title}</h2>{section.body}</section>)}</article></div></main><footer className="legal-footer"><span>© {new Date().getFullYear()} LOTHUUS</span><LegalLinks /><a href="mailto:katrien@lothuus.be">katrien@lothuus.be</a></footer></div>;
}
