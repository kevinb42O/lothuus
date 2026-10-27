import { notFound } from 'next/navigation';
import { HouseEntryStudy } from '@/components/house-entry-study';

export default function IntroStudy() {
  if(process.env.NODE_ENV!=='development')notFound();
  return <HouseEntryStudy/>;
}
